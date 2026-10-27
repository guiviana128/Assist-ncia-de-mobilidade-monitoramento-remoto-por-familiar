package com.assistmob.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisionEventResponseDTO {
    private String eventId;
    private boolean accepted;
    private boolean duplicate;
    private String message;
    private AgentActionResponseDTO supervisedAction;
}
