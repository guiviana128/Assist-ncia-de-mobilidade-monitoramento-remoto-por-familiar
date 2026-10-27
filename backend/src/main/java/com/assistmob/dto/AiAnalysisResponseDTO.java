package com.assistmob.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAnalysisResponseDTO {
    private String deviceId;
    private String answer;
    private String provider;
    private String model;
    private LocalDateTime generatedAt;
    private int telemetrySamples;
    private int alertSamples;
}
