package com.assistmob.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TelemetryRequestDTO {

    @NotBlank(message = "deviceId é obrigatório")
    private String deviceId;

    @NotNull(message = "latitude é obrigatória")
    private Double latitude;

    @NotNull(message = "longitude é obrigatória")
    private Double longitude;

    private Float speedKmh;
    private Integer satellites;
    private Float obstacleDistanceCm;
    private Boolean obstacleDetected;
    private Float batteryPercent;
    private Boolean fallDetected;
}
