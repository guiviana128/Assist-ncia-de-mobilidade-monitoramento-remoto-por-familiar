package com.assistmob.model.enums;

/**
 * Tipos de missão do robô. A prioridade decide qual missão pendente o robô pega primeiro
 * e se uma missão nova pode interromper a atual (ex.: socorro interrompe patrulha).
 */
public enum MissionType {
    RESPOND_TO_ALERT(100),
    GO_TO_ROOM(50),
    GO_TO_POINT(50),
    RETURN_TO_DOCK(20),
    PATROL(10);

    private final int priority;

    MissionType(int priority) {
        this.priority = priority;
    }

    public int getPriority() {
        return priority;
    }

    public boolean isFamilyCommand() {
        return this != RESPOND_TO_ALERT;
    }
}
