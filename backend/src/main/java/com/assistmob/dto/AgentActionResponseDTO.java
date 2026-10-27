package com.assistmob.dto;

import com.assistmob.model.AgentAction;
import com.assistmob.model.enums.AgentActionStatus;
import com.assistmob.model.enums.AgentActionType;
import com.assistmob.model.enums.AgentRiskLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentActionResponseDTO {
    private Long id;
    private String deviceId;
    private String objective;
    private String summary;
    private AgentRiskLevel riskLevel;
    private AgentActionType proposedAction;
    private String justification;
    private AgentActionStatus status;
    private boolean requiresHumanApproval;
    private String reviewedBy;
    private String reviewerNote;
    private String generatedModel;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime executedAt;

    public static AgentActionResponseDTO fromEntity(AgentAction action) {
        return AgentActionResponseDTO.builder()
                .id(action.getId())
                .deviceId(action.getDeviceId())
                .objective(action.getObjective())
                .summary(action.getSummary())
                .riskLevel(action.getRiskLevel())
                .proposedAction(action.getActionType())
                .justification(action.getJustification())
                .status(action.getStatus())
                .requiresHumanApproval(action.isRequiresHumanApproval())
                .reviewedBy(action.getReviewedBy())
                .reviewerNote(action.getReviewerNote())
                .generatedModel(action.getGeneratedModel())
                .requestedAt(action.getRequestedAt())
                .reviewedAt(action.getReviewedAt())
                .executedAt(action.getExecutedAt())
                .build();
    }
}
