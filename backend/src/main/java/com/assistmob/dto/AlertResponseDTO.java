package com.assistmob.dto;

import com.assistmob.model.Alert;
import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertStatus;
import com.assistmob.model.enums.AlertType;
import java.time.LocalDateTime;
import lombok.*;

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
  private String indoorRoom;
  private LocalDateTime createdAt;
  private LocalDateTime resolvedAt;
  private String resolvedBy;
  private String acknowledgedBy;
  private LocalDateTime acknowledgedAt;
  private String notificationState;

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
        .indoorRoom(alert.getIndoorRoom())
        .createdAt(alert.getCreatedAt())
        .resolvedAt(alert.getResolvedAt())
        .resolvedBy(alert.getResolvedBy())
        .acknowledgedBy(alert.getAcknowledgedBy())
        .acknowledgedAt(alert.getAcknowledgedAt())
        .notificationState(alert.getNotificationState())
        .build();
  }
}
