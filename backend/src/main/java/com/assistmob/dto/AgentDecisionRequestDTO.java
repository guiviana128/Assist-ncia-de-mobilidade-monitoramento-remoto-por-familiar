package com.assistmob.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentDecisionRequestDTO {

    @NotNull(message = "approved é obrigatório")
    private Boolean approved;

    @NotBlank(message = "reviewedBy é obrigatório")
    @Size(max = 120, message = "reviewedBy deve ter no máximo 120 caracteres")
    private String reviewedBy;

    @Size(max = 1000, message = "note deve ter no máximo 1000 caracteres")
    private String note;
}
