package com.assistmob.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "tb_vision_events", indexes = {
        @Index(name = "idx_vision_event_device_time", columnList = "deviceId, receivedAt")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisionDetectionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String eventId;

    @Column(nullable = false, length = 120)
    private String sessionId;

    @Column(nullable = false, length = 100)
    private String deviceId;

    @Column(nullable = false, length = 60)
    private String gestureName;

    @Column(nullable = false, length = 60)
    private String phase;

    @Column(nullable = false)
    private Double confidence;

    @Column(nullable = false)
    private Boolean confirmed;

    @Column(nullable = false)
    private OffsetDateTime capturedAt;

    @Column(nullable = false)
    private LocalDateTime receivedAt;

    @Column(nullable = false)
    private Boolean imageStored;

    @Column(nullable = false)
    private Boolean automaticEmergencyCall;

    @Builder.Default
    @Column(length = 24)
    private String reviewStatus = "PENDING";

    private LocalDateTime reviewedAt;

    @Column(length = 120)
    private String reviewedBy;

    private Long agentActionId;
}
