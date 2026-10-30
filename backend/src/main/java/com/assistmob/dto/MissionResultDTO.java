package com.assistmob.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MissionResultDTO(
        @NotNull Boolean success,
        @Size(max = 300) String message
) {
}
