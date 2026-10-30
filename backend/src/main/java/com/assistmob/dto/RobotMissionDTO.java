package com.assistmob.dto;

import com.assistmob.model.RobotMission;
import com.assistmob.model.enums.MissionStatus;
import com.assistmob.model.enums.MissionType;

import java.time.LocalDateTime;

public record RobotMissionDTO(
        Long id,
        String robotId,
        MissionType type,
        int priority,
        MissionStatus status,
        String targetRoom,
        Double targetX,
        Double targetY,
        Long alertId,
        String reason,
        String requestedBy,
        String resultMessage,
        LocalDateTime createdAt,
        LocalDateTime startedAt,
        LocalDateTime finishedAt
) {
    public static RobotMissionDTO fromEntity(RobotMission m) {
        return new RobotMissionDTO(m.getId(), m.getRobotId(), m.getType(), m.getType().getPriority(),
                m.getStatus(), m.getTargetRoom(), m.getTargetX(), m.getTargetY(), m.getAlertId(),
                m.getReason(), m.getRequestedBy(), m.getResultMessage(), m.getCreatedAt(),
                m.getStartedAt(), m.getFinishedAt());
    }
}
