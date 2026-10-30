package com.assistmob.model.enums;

/** Estados da máquina de estados do robô (espelha robot-ros2/amparo_robot/state_machine.py). */
public enum RobotMode {
    IDLE,
    PATROLLING,
    RESPONDING,
    CHECKING_PERSON,
    GOING_TO_GOAL,
    RETURNING,
    OFFLINE
}
