package com.assistmob.dto;

import com.assistmob.model.enums.RobotMode;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** Estado enviado pela ponte ROS 2 a cada ~0,5 s. */
public record RobotStateUpdateDTO(
        @NotNull Double x,
        @NotNull Double y,
        @NotNull Double yaw,
        @NotNull RobotMode mode,
        @DecimalMin("0.0") @DecimalMax("100.0") Double batteryPercent,
        Double nearestObstacleM,
        Long currentMissionId,
        String navStatus
) {
}
