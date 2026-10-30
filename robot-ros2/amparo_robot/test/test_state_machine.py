from amparo_robot.house_layout import DOCK, patrol_targets
from amparo_robot.state_machine import (
    NO_PREEMPTION, CancelNavigation, Mission, Navigate, ReportMission, RobotContext,
)


def make(**kwargs):
    ctx = RobotContext(patrol_targets(), DOCK, check_duration=10.0, **kwargs)
    ctx.start(0.0)
    return ctx


def test_starts_patrolling_first_room():
    ctx = make()
    assert ctx.mode == "PATROLLING"
    actions = ctx.pop_actions()
    assert actions == [Navigate(0.6, 3.0, "patrulha:quarto")]


def test_patrol_advances_even_when_room_is_blocked():
    ctx = make()
    ctx.pop_actions()
    ctx.on_nav_result(False, 1.0)
    assert ctx.pop_actions()[0].label == "patrulha:sala"


def test_alert_interrupts_patrol_and_robot_checks_person():
    ctx = make()
    ctx.pop_actions()
    ctx.on_mission(Mission(7, "RESPOND_TO_ALERT", 0.6, 3.0, "quarto"), 2.0)
    assert ctx.mode == "RESPONDING"
    assert ctx.min_claim_priority == NO_PREEMPTION
    assert ctx.pop_actions() == [CancelNavigation(), Navigate(0.6, 3.0, "missao:7")]

    ctx.on_nav_result(True, 20.0)
    assert ctx.mode == "CHECKING_PERSON"
    assert ctx.pop_actions() == [ReportMission(7, True, "Cheguei até a pessoa (quarto)")]

    ctx.tick(25.0)
    assert ctx.mode == "CHECKING_PERSON"
    ctx.tick(30.0)
    assert ctx.mode == "PATROLLING"


def test_responding_retries_then_reports_failure():
    ctx = make(max_retries=2)
    ctx.on_mission(Mission(3, "RESPOND_TO_ALERT", 5.5, -1.0, "cozinha"), 0.0)
    ctx.pop_actions()
    ctx.on_nav_result(False, 1.0)
    ctx.on_nav_result(False, 2.0)
    assert ctx.mode == "RESPONDING"
    ctx.on_nav_result(False, 3.0)
    actions = ctx.pop_actions()
    assert ReportMission(3, False, "Nav2 não alcançou o destino após 3 tentativas") in actions
    assert ctx.mode == "PATROLLING"


def test_family_goal_reports_and_resumes_patrol():
    ctx = make()
    ctx.on_mission(Mission(4, "GO_TO_POINT", 6.0, 2.5, "escritorio"), 0.0)
    assert ctx.mode == "GOING_TO_GOAL"
    assert ctx.min_claim_priority == 50
    ctx.pop_actions()
    ctx.on_nav_result(True, 5.0)
    actions = ctx.pop_actions()
    assert actions[0] == ReportMission(4, True, "Destino alcançado")
    assert ctx.mode == "PATROLLING"


def test_return_to_dock_disables_patrol():
    ctx = make()
    ctx.on_mission(Mission(5, "RETURN_TO_DOCK", 0.0, 0.0), 0.0)
    assert ctx.mode == "RETURNING"
    ctx.on_nav_result(True, 3.0)
    assert ctx.mode == "IDLE"
    assert ReportMission(5, True, "Robô na base") in ctx.pop_actions()
    ctx.on_mission(Mission(6, "PATROL"), 4.0)
    assert ctx.mode == "PATROLLING"


def test_remote_cancel_stops_navigation():
    ctx = make()
    ctx.on_mission(Mission(8, "GO_TO_ROOM", 4.2, 3.0, "banheiro"), 0.0)
    ctx.pop_actions()
    ctx.on_remote_cancel(1.0)
    actions = ctx.pop_actions()
    assert actions[0] == CancelNavigation()
    assert ctx.mission_id is None
    assert ctx.mode == "PATROLLING"


def test_mission_from_api_payload():
    m = Mission.from_api({"id": 9, "type": "GO_TO_ROOM", "targetX": 1.5, "targetY": -1.5,
                          "targetRoom": "sala", "reason": None})
    assert m.priority == 50 and m.target_room == "sala" and m.reason == ""
