package com.assistmob.dto;

import com.assistmob.model.enums.MissionType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Comando da família pelo painel: ir a um cômodo, ir a um ponto clicado na planta 3D
 * (comando espacial), patrulhar ou voltar à base.
 */
public record MissionRequestDTO(
        @NotNull MissionType type,
        @Size(max = 40) String targetRoom,
        Double targetX,
        Double targetY,
        @Size(max = 200) String reason
) {
}
