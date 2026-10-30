"""Nó ROS 2 que decide o que o robô faz e conversa com o backend Amparo.

Fluxo:
  backend (missões) --HTTP--> [thread BackendWorker] --fila--> [timer ROS] --> RobotContext (State)
  RobotContext --ações--> Nav2 (NavigateToPose) / backend (concluir missão)
  TF map->base_footprint + /scan --> estado do robô --HTTP--> backend --> painel 3D

As chamadas HTTP rodam numa thread separada para nunca travar os callbacks do ROS.
"""
from __future__ import annotations

import math
import os
import queue
import threading
import time
from dataclasses import dataclass
from typing import Optional

import rclpy
from action_msgs.msg import GoalStatus
from geometry_msgs.msg import PoseStamped
from nav2_msgs.action import NavigateToPose
from rclpy.action import ActionClient
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from rclpy.time import Time
from sensor_msgs.msg import LaserScan
from tf2_ros import Buffer, TransformException, TransformListener

from .backend_client import BackendClient, BackendError
from .house_layout import DOCK, patrol_targets
from .scan_pipeline import ObstacleSummary, summarize
from .state_machine import CancelNavigation, Mission, Navigate, ReportMission, RobotContext


@dataclass
class RobotSnapshot:
    x: float = 0.0
    y: float = 0.0
    yaw: float = 0.0
    mode: str = "IDLE"
    mission_id: Optional[int] = None
    min_priority: int = 0
    nav_status: str = "Iniciando"
    nearest_obstacle_m: Optional[float] = None


class BackendWorker(threading.Thread):
    """Envia o estado, pede missões e reporta resultados; devolve eventos por uma fila."""

    def __init__(self, client: BackendClient, period: float, logger):
        super().__init__(daemon=True)
        self.client = client
        self.period = period
        self.logger = logger
        self.snapshot = RobotSnapshot()
        self.lock = threading.Lock()
        self.events: "queue.Queue[tuple]" = queue.Queue()
        self.reports: "queue.Queue[ReportMission]" = queue.Queue()
        self.running = True
        self._was_online = None
        self._awaiting: Optional[tuple[int, float]] = None  # missão entregue ao nó e ainda não assumida

    def update(self, snapshot: RobotSnapshot) -> None:
        with self.lock:
            self.snapshot = snapshot

    def run(self) -> None:
        while self.running:
            started = time.monotonic()
            try:
                self._flush_reports()
                with self.lock:
                    s = self.snapshot
                state = self.client.send_state({
                    "x": round(s.x, 3), "y": round(s.y, 3), "yaw": round(s.yaw, 3),
                    "mode": s.mode, "currentMissionId": s.mission_id,
                    "nearestObstacleM": s.nearest_obstacle_m, "navStatus": s.nav_status,
                    "batteryPercent": None,
                })
                active = (state.get("currentMission") or {}).get("id")
                if self._awaiting and (s.mission_id == self._awaiting[0] or time.monotonic() - self._awaiting[1] > 3.0):
                    self._awaiting = None
                if self._awaiting:
                    pass  # espera o nó assumir a missão antes de pedir outra
                elif s.mission_id is not None and active != s.mission_id:
                    self.events.put(("remote_cancel", s.mission_id))
                else:
                    mission = self.client.claim_mission(s.min_priority)
                    if mission:
                        parsed = Mission.from_api(mission)
                        self._awaiting = (parsed.id, time.monotonic())
                        self.events.put(("mission", parsed))
                self._set_online(True)
            except BackendError as error:
                self._set_online(False, str(error))
            time.sleep(max(0.05, self.period - (time.monotonic() - started)))

    def _flush_reports(self) -> None:
        while True:
            try:
                report = self.reports.get_nowait()
            except queue.Empty:
                return
            try:
                self.client.complete_mission(report.mission_id, report.success, report.message)
            except BackendError:
                self.reports.put(report)  # tenta de novo no próximo ciclo
                raise

    def _set_online(self, online: bool, detail: str = "") -> None:
        if online != self._was_online:
            if online:
                self.logger.info("Conectado ao backend Amparo")
            else:
                self.logger.warning(f"Sem backend: {detail}")
            self._was_online = online


class MissionManager(Node):
    def __init__(self):
        super().__init__("amparo_mission_manager")
        self.declare_parameter("backend_url", "http://localhost:8080/api/v1")
        self.declare_parameter("robot_id", "AMPARO-BOT-01")
        self.declare_parameter("api_key", os.environ.get("ASSISTMOB_DEVICE_API_KEY", "dev-device-key-troque-em-producao"))
        self.declare_parameter("map_frame", "map")
        self.declare_parameter("base_frame", "base_footprint")
        self.declare_parameter("backend_period", 0.5)
        self.declare_parameter("check_duration", 45.0)
        self.declare_parameter("max_retries", 2)
        self.declare_parameter("autostart_patrol", True)

        p = lambda name: self.get_parameter(name).value  # noqa: E731
        self.map_frame = p("map_frame")
        self.base_frame = p("base_frame")

        self.ctx = RobotContext(patrol_targets(), DOCK, check_duration=float(p("check_duration")),
                                max_retries=int(p("max_retries")), autostart_patrol=bool(p("autostart_patrol")))
        self.worker = BackendWorker(BackendClient(p("backend_url"), p("robot_id"), p("api_key")),
                                    float(p("backend_period")), self.get_logger())

        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.nav = ActionClient(self, NavigateToPose, "navigate_to_pose")
        self.create_subscription(LaserScan, "scan", self.on_scan, qos_profile_sensor_data)

        self.pose = (0.0, 0.0, 0.0)
        self.obstacles = ObstacleSummary(None, None, True, "livre")
        self.goal_handle = None
        self.goal_seq = 0
        self.pending_goal: Optional[Navigate] = None
        self.started = False

        self.create_timer(0.1, self.loop)
        self.worker.start()
        self.get_logger().info("Robô assistente Amparo iniciado. Aguardando Nav2...")

    # ------------------------------------------------------------ entradas
    def on_scan(self, msg: LaserScan) -> None:
        self.obstacles = summarize(msg.ranges, msg.angle_min, msg.angle_increment, msg.range_min, msg.range_max)

    def read_pose(self) -> None:
        try:
            t = self.tf_buffer.lookup_transform(self.map_frame, self.base_frame, Time())
        except TransformException:
            return
        q = t.transform.rotation
        yaw = math.atan2(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z))
        self.pose = (t.transform.translation.x, t.transform.translation.y, yaw)

    # ------------------------------------------------------------ laço principal (10 Hz)
    def loop(self) -> None:
        now = time.monotonic()
        self.read_pose()

        if not self.started and self.nav.server_is_ready():
            self.started = True
            self.get_logger().info("Nav2 pronto: iniciando comportamento padrão")
            self.ctx.start(now)

        while True:
            try:
                kind, payload = self.worker.events.get_nowait()
            except queue.Empty:
                break
            if kind == "mission":
                self.get_logger().info(f"Nova missão #{payload.id}: {payload.type} -> {payload.target_room}")
                self.ctx.on_mission(payload, now)
            elif kind == "remote_cancel" and payload == self.ctx.mission_id:
                self.get_logger().info(f"Missão #{payload} cancelada pela família")
                self.ctx.on_remote_cancel(now)

        if self.started:
            self.ctx.tick(now)
        self.execute(self.ctx.pop_actions())

        if self.pending_goal and self.nav.server_is_ready():
            goal, self.pending_goal = self.pending_goal, None
            self.send_goal(goal)

        status = self.ctx.status_text() if self.started else "Aguardando Nav2"
        if self.started and not self.obstacles.front_clear:
            status += f" · obstáculo à frente ({self.obstacles.nearest_m} m), Nav2 desviando"
        self.worker.update(RobotSnapshot(
            x=self.pose[0], y=self.pose[1], yaw=self.pose[2], mode=self.ctx.mode,
            mission_id=self.ctx.mission_id, min_priority=self.ctx.min_claim_priority if self.started else 1000,
            nav_status=status, nearest_obstacle_m=self.obstacles.nearest_m))

    # ------------------------------------------------------------ saídas
    def execute(self, actions) -> None:
        for action in actions:
            if isinstance(action, Navigate):
                if self.nav.server_is_ready():
                    self.send_goal(action)
                else:
                    self.pending_goal = action
            elif isinstance(action, CancelNavigation):
                self.cancel_goal()
            elif isinstance(action, ReportMission):
                self.get_logger().info(f"Missão #{action.mission_id}: {'OK' if action.success else 'FALHOU'} - {action.message}")
                self.worker.reports.put(action)

    def send_goal(self, target: Navigate) -> None:
        self.goal_seq += 1
        seq = self.goal_seq
        goal = NavigateToPose.Goal()
        pose = PoseStamped()
        pose.header.frame_id = self.map_frame
        pose.header.stamp = self.get_clock().now().to_msg()
        pose.pose.position.x = float(target.x)
        pose.pose.position.y = float(target.y)
        heading = math.atan2(target.y - self.pose[1], target.x - self.pose[0])
        pose.pose.orientation.z = math.sin(heading / 2.0)
        pose.pose.orientation.w = math.cos(heading / 2.0)
        goal.pose = pose
        self.get_logger().info(f"Nav2 -> {target.label} ({target.x:.2f}, {target.y:.2f})")
        self.nav.send_goal_async(goal).add_done_callback(lambda f: self.on_goal_response(f, seq))

    def on_goal_response(self, future, seq: int) -> None:
        handle = future.result()
        if seq != self.goal_seq:
            if handle.accepted:
                handle.cancel_goal_async()
            return
        if not handle.accepted:
            self.get_logger().warning("Nav2 recusou o objetivo")
            self.ctx.on_nav_result(False, time.monotonic())
            return
        self.goal_handle = handle
        handle.get_result_async().add_done_callback(lambda f: self.on_result(f, seq))

    def on_result(self, future, seq: int) -> None:
        if seq != self.goal_seq:
            return  # resultado de um objetivo antigo (foi substituído ou cancelado)
        self.goal_handle = None
        status = future.result().status
        self.ctx.on_nav_result(status == GoalStatus.STATUS_SUCCEEDED, time.monotonic())

    def cancel_goal(self) -> None:
        self.goal_seq += 1  # invalida callbacks pendentes
        self.pending_goal = None
        if self.goal_handle is not None:
            self.goal_handle.cancel_goal_async()
            self.goal_handle = None

    def destroy_node(self):
        self.worker.running = False
        return super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = MissionManager()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
