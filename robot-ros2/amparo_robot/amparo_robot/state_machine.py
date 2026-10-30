"""Máquina de estados do robô assistente (Design Pattern State + paradigma orientado a objetos).

Cada estado é uma classe com o próprio comportamento (enter / on_nav_result / tick).
O RobotContext guarda os dados compartilhados e troca o estado atual.
O módulo não depende do ROS: ele só recebe eventos e devolve ações (Navigate, CancelNavigation,
ReportMission). Quem executa as ações é o nó mission_manager_node.py. Isso permite testar toda a
lógica de decisão com pytest (test/test_state_machine.py).

Comportamento de decisão (requisito "Navegação Autônoma" do NEXUS):
  - sem missão, o robô PATRULHA a casa cômodo a cômodo;
  - um alerta da bengala (queda/SOS) vira missão RESPOND_TO_ALERT: ele interrompe tudo,
    vai até o cômodo da pessoa e fica VERIFICANDO por alguns segundos;
  - a família pode mandar o robô a um cômodo/ponto, patrulhar ou voltar à base.
"""
from __future__ import annotations

from abc import ABC
from dataclasses import dataclass
from typing import Optional, Sequence, Union

PRIORITY = {
    "RESPOND_TO_ALERT": 100,
    "GO_TO_ROOM": 50,
    "GO_TO_POINT": 50,
    "RETURN_TO_DOCK": 20,
    "PATROL": 10,
}
NO_PREEMPTION = max(PRIORITY.values()) + 1


# ------------------------------------------------------------------ dados


@dataclass(frozen=True)
class Mission:
    id: int
    type: str
    target_x: Optional[float] = None
    target_y: Optional[float] = None
    target_room: Optional[str] = None
    reason: str = ""

    @property
    def priority(self) -> int:
        return PRIORITY.get(self.type, 0)

    @staticmethod
    def from_api(data: dict) -> "Mission":
        return Mission(
            id=int(data["id"]),
            type=str(data["type"]),
            target_x=data.get("targetX"),
            target_y=data.get("targetY"),
            target_room=data.get("targetRoom"),
            reason=data.get("reason") or "",
        )


@dataclass(frozen=True)
class Navigate:
    x: float
    y: float
    label: str


@dataclass(frozen=True)
class CancelNavigation:
    pass


@dataclass(frozen=True)
class ReportMission:
    mission_id: int
    success: bool
    message: str


Action = Union[Navigate, CancelNavigation, ReportMission]


# ------------------------------------------------------------------ estados


class State(ABC):
    mode = "IDLE"
    min_claim_priority = 0

    def enter(self, ctx: "RobotContext", now: float) -> None:
        pass

    def on_nav_result(self, ctx: "RobotContext", success: bool, now: float) -> None:
        pass

    def tick(self, ctx: "RobotContext", now: float) -> None:
        pass

    def describe(self, ctx: "RobotContext") -> str:
        return self.mode

    def __repr__(self) -> str:
        return type(self).__name__


class IdleState(State):
    mode = "IDLE"

    def describe(self, ctx):
        return "Parado, aguardando comando"


class PatrollingState(State):
    mode = "PATROLLING"

    def enter(self, ctx, now):
        self._go_next(ctx)

    def on_nav_result(self, ctx, success, now):
        # Se um cômodo estiver bloqueado, pula para o próximo em vez de travar a patrulha
        ctx.patrol_index = (ctx.patrol_index + 1) % len(ctx.patrol_targets)
        self._go_next(ctx)

    def describe(self, ctx):
        room, _, _ = ctx.patrol_targets[ctx.patrol_index]
        return f"Patrulhando: indo para {room}"

    @staticmethod
    def _go_next(ctx):
        room, x, y = ctx.patrol_targets[ctx.patrol_index]
        ctx.emit(Navigate(x, y, f"patrulha:{room}"))


class MissionNavigationState(State):
    """Base para estados que levam o robô até o destino de uma missão (Template Method)."""

    def enter(self, ctx, now):
        ctx.emit(Navigate(self.target(ctx)[0], self.target(ctx)[1], self.label(ctx)))

    def target(self, ctx) -> tuple[float, float]:
        mission = ctx.mission
        return float(mission.target_x), float(mission.target_y)

    def label(self, ctx) -> str:
        return f"missao:{ctx.mission.id}"

    def on_nav_result(self, ctx, success, now):
        if success:
            self.on_arrived(ctx, now)
            return
        if ctx.retries < ctx.max_retries:
            ctx.retries += 1
            ctx.emit(Navigate(*self.target(ctx), self.label(ctx)))
            return
        self.on_gave_up(ctx, now)

    def on_arrived(self, ctx, now):
        ctx.finish_mission(True, "Destino alcançado", now)

    def on_gave_up(self, ctx, now):
        ctx.finish_mission(False, f"Nav2 não alcançou o destino após {ctx.max_retries + 1} tentativas", now)


class GoingToGoalState(MissionNavigationState):
    mode = "GOING_TO_GOAL"
    min_claim_priority = PRIORITY["GO_TO_ROOM"]  # um comando manual mais novo ou socorro interrompem

    def describe(self, ctx):
        return f"Indo para {ctx.mission.target_room or 'ponto escolhido'} (comando da família)"


class RespondingState(MissionNavigationState):
    mode = "RESPONDING"
    min_claim_priority = NO_PREEMPTION  # nada interrompe um socorro

    def on_arrived(self, ctx, now):
        mission = ctx.mission
        ctx.emit(ReportMission(mission.id, True, f"Cheguei até a pessoa ({mission.target_room})"))
        ctx.mission = None
        ctx.transition(CheckingPersonState(mission.target_room or ""), now)

    def describe(self, ctx):
        return f"SOCORRO: indo até a pessoa ({ctx.mission.target_room})"


class CheckingPersonState(State):
    """Robô parado ao lado da pessoa, câmera apontada para ela, até o tempo acabar ou chegar comando."""

    mode = "CHECKING_PERSON"
    min_claim_priority = 0

    def __init__(self, room: str):
        self.room = room
        self.since = 0.0

    def enter(self, ctx, now):
        self.since = now

    def tick(self, ctx, now):
        if now - self.since >= ctx.check_duration:
            ctx.resume(now)

    def describe(self, ctx):
        return f"Verificando a pessoa ({self.room})"


class ReturningState(MissionNavigationState):
    mode = "RETURNING"

    def target(self, ctx):
        return ctx.dock

    def label(self, ctx):
        return "base"

    def on_arrived(self, ctx, now):
        if ctx.mission:
            ctx.emit(ReportMission(ctx.mission.id, True, "Robô na base"))
            ctx.mission = None
        ctx.transition(IdleState(), now)

    def on_gave_up(self, ctx, now):
        if ctx.mission:
            ctx.emit(ReportMission(ctx.mission.id, False, "Não consegui voltar para a base"))
            ctx.mission = None
        ctx.transition(IdleState(), now)

    def describe(self, ctx):
        return "Voltando para a base"


# ------------------------------------------------------------------ contexto


class RobotContext:
    def __init__(self, patrol_targets: Sequence[tuple[str, float, float]], dock: tuple[float, float],
                 check_duration: float = 45.0, max_retries: int = 2, autostart_patrol: bool = True):
        if not patrol_targets:
            raise ValueError("A rota de patrulha não pode ser vazia")
        self.patrol_targets = list(patrol_targets)
        self.dock = dock
        self.check_duration = check_duration
        self.max_retries = max_retries
        self.patrol_enabled = autostart_patrol
        self.patrol_index = 0
        self.mission: Optional[Mission] = None
        self.retries = 0
        self.state: State = IdleState()
        self._outbox: list[Action] = []

    # ---- consultas
    @property
    def mode(self) -> str:
        return self.state.mode

    @property
    def min_claim_priority(self) -> int:
        return self.state.min_claim_priority

    @property
    def mission_id(self) -> Optional[int]:
        return self.mission.id if self.mission else None

    def status_text(self) -> str:
        return self.state.describe(self)

    # ---- infraestrutura
    def emit(self, action: Action) -> None:
        self._outbox.append(action)

    def pop_actions(self) -> list[Action]:
        actions, self._outbox = self._outbox, []
        return actions

    def transition(self, new_state: State, now: float) -> None:
        self.state = new_state
        new_state.enter(self, now)

    def resume(self, now: float) -> None:
        """Volta ao comportamento padrão depois de uma missão."""
        self.transition(PatrollingState() if self.patrol_enabled else IdleState(), now)

    def finish_mission(self, success: bool, message: str, now: float) -> None:
        if self.mission:
            self.emit(ReportMission(self.mission.id, success, message))
            self.mission = None
        self.resume(now)

    # ---- eventos
    def start(self, now: float) -> None:
        self.resume(now)

    def on_mission(self, mission: Mission, now: float) -> None:
        if isinstance(self.state, (PatrollingState, MissionNavigationState)):
            self.emit(CancelNavigation())  # o backend já marcou a missão anterior como interrompida
        self.mission = mission
        self.retries = 0

        if mission.type == "PATROL":
            self.patrol_enabled = True
            self.emit(ReportMission(mission.id, True, "Patrulha iniciada"))
            self.mission = None
            self.transition(PatrollingState(), now)
        elif mission.type == "RETURN_TO_DOCK":
            self.patrol_enabled = False
            self.transition(ReturningState(), now)
        elif mission.type == "RESPOND_TO_ALERT":
            self.transition(RespondingState(), now)
        elif mission.type in ("GO_TO_ROOM", "GO_TO_POINT") and mission.target_x is not None:
            self.transition(GoingToGoalState(), now)
        else:
            self.emit(ReportMission(mission.id, False, f"Missão não suportada: {mission.type}"))
            self.mission = None
            self.resume(now)

    def on_nav_result(self, success: bool, now: float) -> None:
        self.state.on_nav_result(self, success, now)

    def on_remote_cancel(self, now: float) -> None:
        """A família cancelou a missão atual no painel (o backend não a lista mais como ativa)."""
        if self.mission is None:
            return
        self.mission = None
        self.emit(CancelNavigation())
        self.resume(now)

    def tick(self, now: float) -> None:
        self.state.tick(self, now)
