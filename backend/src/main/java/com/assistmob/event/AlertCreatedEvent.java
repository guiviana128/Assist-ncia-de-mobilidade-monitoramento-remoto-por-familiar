package com.assistmob.event;

import com.assistmob.model.Alert;

/**
 * Evento publicado sempre que um alerta é registrado (padrão Observer).
 * O AlertService não conhece o robô: quem se interessa pelo alerta (RobotMissionService)
 * apenas escuta o evento. Assim novos "ouvintes" podem ser adicionados sem mexer no AlertService.
 */
public record AlertCreatedEvent(Alert alert) {
}
