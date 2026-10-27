package com.assistmob.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAnalysisRequestDTO {

    @NotBlank(message = "deviceId é obrigatório")
    @Size(max = 100, message = "deviceId deve ter no máximo 100 caracteres")
    private String deviceId;

    @Size(max = 1000, message = "question deve ter no máximo 1000 caracteres")
    private String question;

    @Min(value = 1, message = "telemetryLimit deve ser maior que zero")
    @Max(value = 50, message = "telemetryLimit deve ser no máximo 50")
    private Integer telemetryLimit;
}
