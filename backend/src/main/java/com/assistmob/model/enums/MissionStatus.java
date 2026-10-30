package com.assistmob.model.enums;

public enum MissionStatus {
    PENDING,
    IN_PROGRESS,
    COMPLETED,
    FAILED,
    CANCELLED;

    public boolean isFinished() {
        return this == COMPLETED || this == FAILED || this == CANCELLED;
    }
}
