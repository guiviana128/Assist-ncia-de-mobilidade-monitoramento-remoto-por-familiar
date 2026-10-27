package com.assistmob.dto;

import com.assistmob.model.VisionDetectionEvent;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

public record VisionEventHistoryDTO(
        String eventId,
        String deviceId,
        String gestureName,
        String phase,
        double confidence,
        boolean confirmed,
        OffsetDateTime capturedAt,
        LocalDateTime receivedAt,
        String reviewStatus,
        LocalDateTime reviewedAt,
        String reviewedBy,
        Long agentActionId
) {
    public static VisionEventHistoryDTO fromEntity(VisionDetectionEvent event) {
        return new VisionEventHistoryDTO(
                event.getEventId(),
                event.getDeviceId(),
                event.getGestureName(),
                event.getPhase(),
                event.getConfidence(),
                event.getConfirmed(),
                event.getCapturedAt(),
                event.getReceivedAt(),
                event.getReviewStatus(),
                event.getReviewedAt(),
                event.getReviewedBy(),
                event.getAgentActionId()
        );
    }
}
