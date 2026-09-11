package com.assistmob.dto;

import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRequestDTO {

    @NotBlank(message = "deviceId é obrigatório")
    private String deviceId;

    @NotNull(message = "alertType é obrigatório")
    private AlertType alertType;

    private AlertSeverity severity;
    private String message;
    private Double latitude;
    private Double longitude;
    private Float batteryLevel;
}
