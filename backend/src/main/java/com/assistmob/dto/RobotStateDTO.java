package com.assistmob.dto;

import com.assistmob.model.enums.RobotMode;

import java.time.LocalDateTime;

/** Estado do robô que o painel 3D consome. */
public record RobotStateDTO(
        String robotId,
        boolean online,
        double x,
        double y,
        double yaw,
        RobotMode mode,
        String currentRoom,
        Double batteryPercent,
        Double nearestObstacleM,
        String navStatus,
        RobotMissionDTO currentMission,
        String personRoom,
        LocalDateTime lastUpdate
) {
}
