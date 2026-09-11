package com.assistmob.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_devices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Device {

    @Id
    @Column(nullable = false, unique = true)
    private String deviceId; // Ex: ESP32-MOB-001

    private String name; // Ex: "Bengala Inteligente do Vovô"

    private String macAddress;

    private String firmwareVersion;

    private boolean isOnline;

    private Double lastLatitude;

    private Double lastLongitude;

    private Float lastBatteryPercent;

    private LocalDateTime lastPingAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id")
    private User patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guardian_id")
    private User guardian;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
