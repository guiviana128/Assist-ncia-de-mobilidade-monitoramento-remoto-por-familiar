package com.assistmob.dto;

import com.assistmob.model.Alert;
import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertStatus;
import com.assistmob.model.enums.AlertType;
import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertResponseDTO {
    private Long id;
    private String deviceId;
    private AlertType alertType;
    private AlertSeverity severity;
    private AlertStatus status;
    private String message;
    private Double latitude;
    private Double longitude;
    private Float batteryLevel;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;

    public static AlertResponseDTO fromEntity(Alert alert) {
        return AlertResponseDTO.builder()
                .id(alert.getId())
                .deviceId(alert.getDeviceId())
                .alertType(alert.getAlertType())
                .severity(alert.getSeverity())
                .status(alert.getStatus())
                .message(alert.getMessage())
                .latitude(alert.getLatitude())
                .longitude(alert.getLongitude())
                .batteryLevel(alert.getBatteryLevel())
                .createdAt(alert.getCreatedAt())
                .resolvedAt(alert.getResolvedAt())
                .build();
    }
}
