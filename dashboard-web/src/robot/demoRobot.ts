// Robô simulado no navegador, usado só no modo demonstração (backend/ROS 2 offline).
// Reproduz de forma simplificada a máquina de estados do robô real (robot-ros2/.../state_machine.py).
import type { HouseLayout, MissionRequest, MissionType, Point2D, RobotMission, RobotMode, RobotState } from '../types/robot';
import { findRoom, planPath, roomAt } from './houseLayout';

const PRIORITY: Record<MissionType, number> = {
  RESPOND_TO_ALERT: 100, GO_TO_ROOM: 50, GO_TO_POINT: 50, RETURN_TO_DOCK: 20, PATROL: 10
};
const SPEED = 0.7; // m/s
const TURN_SPEED = 2.5; // rad/s
const CHECK_SECONDS = 15;

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class DemoRobot {
  private x: number;
  private y: number;
  private yaw = 0;
  private mode: RobotMode = 'IDLE';
  private path: Point2D[] = [];
  private mission: RobotMission | null = null;
  private history: RobotMission[] = [];
  private patrolIndex = 0;
  private patrolEnabled = true;
  private checkingFor = 0;
  private personRoom: string | null = 'sala';
  private nextId = 1;

  constructor(private readonly layout: HouseLayout, readonly robotId = 'AMPARO-BOT-01') {
    this.x = layout.dock.x;
    this.y = layout.dock.y;
    this.resume();
  }

  getState(): RobotState {
    return {
      robotId: this.robotId,
      online: true,
      x: this.x,
      y: this.y,
      yaw: this.yaw,
      mode: this.mode,
      currentRoom: roomAt(this.layout, { x: this.x, y: this.y })?.id ?? null,
      batteryPercent: null,
      nearestObstacleM: this.nearestWallDistance(),
      navStatus: this.status(),
      currentMission: this.mission ? { ...this.mission } : null,
      personRoom: this.personRoom,
      lastUpdate: new Date().toISOString()
    };
  }

  listMissions(limit = 10): RobotMission[] {
    return this.history.slice(0, limit).map(m => ({ ...m }));
  }

  request(req: MissionRequest, requestedBy = 'Familiar (demonstração)'): RobotMission {
    let target: Point2D | null = null;
    let targetRoom: string | null = null;
    if (req.type === 'GO_TO_ROOM') {
      const room = findRoom(this.layout, req.targetRoom);
      if (!room) throw new Error(`Cômodo desconhecido: ${req.targetRoom}`);
      target = { x: room.targetX, y: room.targetY };
      targetRoom = room.id;
    } else if (req.type === 'GO_TO_POINT') {
      if (req.targetX == null || req.targetY == null) throw new Error('Ponto inválido');
      target = { x: req.targetX, y: req.targetY };
      targetRoom = roomAt(this.layout, target)?.id ?? null;
      if (!targetRoom) throw new Error('O ponto escolhido está fora da planta da casa.');
    } else if (req.type === 'RETURN_TO_DOCK') {
      target = { ...this.layout.dock };
      targetRoom = roomAt(this.layout, target)?.id ?? null;
    }
    if (this.mission?.type === 'RESPOND_TO_ALERT') {
      // Igual ao robô real: socorro não é interrompido; o comando fica registrado como cancelado
      const skipped = this.newMission(req.type, target, targetRoom, req.reason ?? 'Comando da família', requestedBy);
      skipped.status = 'CANCELLED';
      skipped.resultMessage = 'Robô atendendo socorro; comando ignorado';
      return skipped;
    }
    return this.start(this.newMission(req.type, target, targetRoom, req.reason ?? 'Comando da família', requestedBy));
  }

  emergency(roomId: string | undefined, reason: string, alertId?: number): RobotMission {
    const room = findRoom(this.layout, roomId) ?? findRoom(this.layout, this.personRoom) ?? this.layout.rooms[0];
    this.personRoom = room.id;
    const mission = this.newMission('RESPOND_TO_ALERT', { x: room.targetX, y: room.targetY }, room.id,
      `${reason} · ${room.name}`, `Sistema${alertId ? ` (alerta #${alertId})` : ''}`);
    mission.alertId = alertId ?? null;
    if (this.mission?.type === 'RESPOND_TO_ALERT') return mission; // fica na fila (simplificado)
    return this.start(mission);
  }

  setPersonRoom(roomId?: string) {
    if (findRoom(this.layout, roomId)) this.personRoom = roomId!;
  }

  cancel(missionId: number): RobotMission | undefined {
    const mission = this.history.find(m => m.id === missionId);
    if (!mission || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(mission.status)) return mission;
    this.finish(mission, 'CANCELLED', 'Cancelada pela família');
    if (this.mission?.id === missionId) {
      this.mission = null;
      this.resume();
    }
    return mission;
  }

  tick(dt: number) {
    if (this.mode === 'CHECKING_PERSON') {
      this.checkingFor += dt;
      if (this.checkingFor >= CHECK_SECONDS) this.resume();
      return;
    }
    const next = this.path[0];
    if (!next) return;

    const heading = Math.atan2(next.y - this.y, next.x - this.x);
    const turn = angleDiff(heading, this.yaw);
    this.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TURN_SPEED * dt);
    if (Math.abs(turn) > 0.6) return; // gira no lugar antes de andar

    const dist = Math.hypot(next.x - this.x, next.y - this.y);
    const step = Math.min(dist, SPEED * dt);
    this.x += Math.cos(heading) * step;
    this.y += Math.sin(heading) * step;
    if (dist - step < 0.02) {
      this.path.shift();
      if (!this.path.length) this.arrived();
    }
  }

  private start(mission: RobotMission): RobotMission {
    if (this.mission && this.mission.id !== mission.id) {
      this.finish(this.mission, 'CANCELLED', `Interrompida pela missão ${mission.type}`);
    }
    mission.status = 'IN_PROGRESS';
    mission.startedAt = new Date().toISOString();
    if (mission.type === 'PATROL') {
      this.patrolEnabled = true;
      this.finish(mission, 'COMPLETED', 'Patrulha iniciada');
      this.mission = null;
      this.resume();
      return mission;
    }
    if (mission.type === 'RETURN_TO_DOCK') this.patrolEnabled = false;
    this.mission = mission;
    this.mode = mission.type === 'RESPOND_TO_ALERT' ? 'RESPONDING' : mission.type === 'RETURN_TO_DOCK' ? 'RETURNING' : 'GOING_TO_GOAL';
    this.goTo({ x: mission.targetX!, y: mission.targetY! });
    return mission;
  }

  private arrived() {
    const mission = this.mission;
    if (mission?.type === 'RESPOND_TO_ALERT') {
      this.finish(mission, 'COMPLETED', `Cheguei até a pessoa (${mission.targetRoom})`);
      this.mission = null;
      this.mode = 'CHECKING_PERSON';
      this.checkingFor = 0;
      return;
    }
    if (mission) {
      this.finish(mission, 'COMPLETED', mission.type === 'RETURN_TO_DOCK' ? 'Robô na base' : 'Destino alcançado');
      this.mission = null;
    }
    if (this.mode === 'PATROLLING') {
      this.patrolIndex = (this.patrolIndex + 1) % this.layout.patrolRoute.length;
      this.goToPatrolPoint();
      return;
    }
    this.resume();
  }

  private resume() {
    if (this.patrolEnabled) {
      this.mode = 'PATROLLING';
      this.goToPatrolPoint();
    } else {
      this.mode = 'IDLE';
      this.path = [];
    }
  }

  private goToPatrolPoint() {
    const room = findRoom(this.layout, this.layout.patrolRoute[this.patrolIndex]);
    if (room) this.goTo({ x: room.targetX, y: room.targetY });
  }

  private goTo(target: Point2D) {
    this.path = planPath(this.layout, { x: this.x, y: this.y }, target).slice(1);
  }

  private newMission(type: MissionType, target: Point2D | null, targetRoom: string | null,
                     reason: string, requestedBy: string): RobotMission {
    const mission: RobotMission = {
      id: this.nextId++, robotId: this.robotId, type, priority: PRIORITY[type], status: 'PENDING',
      targetRoom, targetX: target?.x ?? null, targetY: target?.y ?? null, reason, requestedBy,
      createdAt: new Date().toISOString()
    };
    this.history.unshift(mission);
    this.history = this.history.slice(0, 30);
    return mission;
  }

  private finish(mission: RobotMission, status: RobotMission['status'], message: string) {
    mission.status = status;
    mission.resultMessage = message;
    mission.finishedAt = new Date().toISOString();
  }

  private status(): string {
    switch (this.mode) {
      case 'PATROLLING': return `Patrulhando: indo para ${this.layout.patrolRoute[this.patrolIndex]}`;
      case 'RESPONDING': return `SOCORRO: indo até a pessoa (${this.mission?.targetRoom})`;
      case 'CHECKING_PERSON': return `Verificando a pessoa (${this.personRoom})`;
      case 'GOING_TO_GOAL': return `Indo para ${this.mission?.targetRoom ?? 'ponto escolhido'} (comando da família)`;
      case 'RETURNING': return 'Voltando para a base';
      default: return 'Parado, aguardando comando';
    }
  }

  /** Distância até a parede mais próxima (imita a leitura do LiDAR no modo demonstração). */
  private nearestWallDistance(): number {
    const p = { x: this.x, y: this.y };
    const dist = this.layout.walls.map(w => {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x - (w.x1 + t * dx), p.y - (w.y1 + t * dy));
    });
    return Math.round(Math.min(...dist) * 100) / 100;
  }
}
