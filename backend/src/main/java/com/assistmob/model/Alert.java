package com.assistmob.model;

import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertStatus;
import com.assistmob.model.enums.AlertType;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_alerts", indexes = {
    @Index(name = "idx_alert_device_status", columnList = "deviceId, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String deviceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertType alertType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertSeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertStatus status;

    private String message;

    private Double latitude;

    private Double longitude;

    private Float batteryLevel;

    private LocalDateTime resolvedAt;

    private String resolvedBy;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
