package com.assistmob.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_telemetry", indexes = {
    @Index(name = "idx_telemetry_device_time", columnList = "deviceId, recordedAt")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Telemetry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String deviceId;

    private Double latitude;

    private Double longitude;

    private Float speedKmh;

    private Integer satellites;

    private Float obstacleDistanceCm;

    private Boolean obstacleDetected;

    private Float batteryPercent;

    private Boolean fallDetected;

    @Builder.Default
    private LocalDateTime recordedAt = LocalDateTime.now();
}
