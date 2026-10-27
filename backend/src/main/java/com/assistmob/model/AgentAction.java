package com.assistmob.model;

import com.assistmob.model.enums.AgentActionStatus;
import com.assistmob.model.enums.AgentActionType;
import com.assistmob.model.enums.AgentRiskLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

@Entity
@Table(name = "tb_agent_actions", indexes = {
        @Index(name = "idx_agent_action_device_time", columnList = "deviceId, requestedAt"),
        @Index(name = "idx_agent_action_status", columnList = "status")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String deviceId;

    @Column(nullable = false, length = 1000)
    private String objective;

    @Column(nullable = false, length = 2000)
    private String summary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AgentRiskLevel riskLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AgentActionType actionType;

    @Column(nullable = false, length = 2000)
    private String justification;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AgentActionStatus status;

    @Column(nullable = false)
    private boolean requiresHumanApproval;

    @Column(nullable = false)
    private LocalDateTime requestedAt;

    private LocalDateTime reviewedAt;
    private LocalDateTime executedAt;

    @Column(length = 120)
    private String reviewedBy;

    @Column(length = 1000)
    private String reviewerNote;

    @Column(length = 120)
    private String generatedModel;
}
