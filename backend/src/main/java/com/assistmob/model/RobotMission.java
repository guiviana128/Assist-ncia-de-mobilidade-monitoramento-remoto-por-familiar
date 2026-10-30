package com.assistmob.model;

import com.assistmob.model.enums.MissionStatus;
import com.assistmob.model.enums.MissionType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Missão enviada ao robô assistente (socorro, ida a um cômodo, patrulha, volta à base). */
@Entity
@Table(name = "tb_robot_missions", indexes = {
    @Index(name = "idx_mission_robot_status", columnList = "robotId, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RobotMission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String robotId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MissionType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MissionStatus status;

    /** Cômodo de destino (id do HouseLayout). Nulo para GO_TO_POINT e PATROL. */
    private String targetRoom;

    /** Coordenadas de destino no frame "map" (metros). */
    private Double targetX;
    private Double targetY;

    /** Alerta que originou a missão (somente RESPOND_TO_ALERT). */
    private Long alertId;

    /** Bengala da pessoa atendida (usado nos alertas de retorno do robô). */
    private String deviceId;

    private String reason;
    private String requestedBy;
    private String resultMessage;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
}
