package com.assistmob.service;

import com.assistmob.dto.AgentActionResponseDTO;
import com.assistmob.dto.AgentDecisionRequestDTO;
import com.assistmob.dto.AgentRunRequestDTO;
import com.assistmob.dto.AlertRequestDTO;
import com.assistmob.model.AgentAction;
import com.assistmob.model.Alert;
import com.assistmob.model.Telemetry;
import com.assistmob.model.enums.AgentActionStatus;
import com.assistmob.model.enums.AgentActionType;
import com.assistmob.model.enums.AgentRiskLevel;
import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertType;
import com.assistmob.repository.AgentActionRepository;
import com.assistmob.repository.AlertRepository;
import com.assistmob.repository.TelemetryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SupervisedAgentService {

    private static final String SYSTEM_PROMPT = """
            Você é o agente local supervisionado do AssistMob.
            Analise somente a telemetria e os alertas fornecidos.
            Nunca execute ações, nunca presuma confirmação humana e nunca faça diagnóstico médico.
            Proponha exatamente uma ação entre:
            NO_ACTION, CHECK_PERSON, CONTACT_PERSON, CHARGE_DEVICE,
            REVIEW_LOCATION, CREATE_FAMILY_ALERT ou CALL_EMERGENCY.
            CALL_EMERGENCY é apenas recomendação e jamais deve ser executada automaticamente.
            Responda exclusivamente como JSON com:
            summary, riskLevel, proposedAction e justification.
            riskLevel deve ser LOW, MEDIUM, HIGH ou CRITICAL.
            Escreva os textos em português do Brasil, de forma objetiva.
            """;

    private final TelemetryRepository telemetryRepository;
    private final AlertRepository alertRepository;
    private final AgentActionRepository agentActionRepository;
    private final AlertService alertService;
    private final OllamaClient ollamaClient;
    private final ObjectMapper objectMapper;

    public AgentActionResponseDTO run(AgentRunRequestDTO request) {
        int limit = request.getTelemetryLimit() == null ? 10 : request.getTelemetryLimit();
        String objective = request.getObjective() == null || request.getObjective().isBlank()
                ? "Avaliar o estado atual e propor a ação mais segura para o familiar."
                : request.getObjective().trim();

        List<Telemetry> telemetry = telemetryRepository.findByDeviceIdOrderByRecordedAtDesc(
                request.getDeviceId(), PageRequest.of(0, limit));
        List<Alert> alerts = alertRepository.findByDeviceIdOrderByCreatedAtDesc(
                request.getDeviceId(), PageRequest.of(0, 10));

        OllamaClient.Generation generation = ollamaClient.chatJson(
                SYSTEM_PROMPT,
                buildContext(request.getDeviceId(), objective, telemetry, alerts));
        AgentPlan plan = parsePlan(generation.answer());

        AgentAction action = AgentAction.builder()
                .deviceId(request.getDeviceId())
                .objective(objective)
                .summary(limit(plan.summary(), 1900))
                .riskLevel(plan.riskLevel())
                .actionType(plan.actionType())
                .justification(limit(plan.justification(), 1900))
                .status(AgentActionStatus.PENDING_APPROVAL)
                .requiresHumanApproval(true)
                .requestedAt(LocalDateTime.now())
                .generatedModel(generation.model())
                .build();

        return AgentActionResponseDTO.fromEntity(agentActionRepository.save(action));
    }

    @Transactional
    public AgentActionResponseDTO decide(Long actionId, AgentDecisionRequestDTO request) {
        AgentAction action = agentActionRepository.findById(actionId)
                .orElseThrow(() -> new IllegalArgumentException("Proposta do agente não encontrada: " + actionId));

        if (action.getStatus() != AgentActionStatus.PENDING_APPROVAL) {
            throw new IllegalArgumentException("Esta proposta já foi revisada");
        }

        action.setReviewedAt(LocalDateTime.now());
        action.setReviewedBy(request.getReviewedBy().trim());
        action.setReviewerNote(request.getNote());

        if (!Boolean.TRUE.equals(request.getApproved())) {
            action.setStatus(AgentActionStatus.REJECTED);
            return AgentActionResponseDTO.fromEntity(agentActionRepository.save(action));
        }

        action.setStatus(AgentActionStatus.APPROVED);

        if (action.getActionType() == AgentActionType.CREATE_FAMILY_ALERT) {
            createApprovedAlert(action);
            action.setStatus(AgentActionStatus.EXECUTED);
            action.setExecutedAt(LocalDateTime.now());
        }

        return AgentActionResponseDTO.fromEntity(agentActionRepository.save(action));
    }

    public AgentActionResponseDTO getById(Long actionId) {
        return agentActionRepository.findById(actionId)
                .map(AgentActionResponseDTO::fromEntity)
                .orElseThrow(() -> new IllegalArgumentException("Proposta do agente não encontrada: " + actionId));
    }

    public List<AgentActionResponseDTO> getRecent(String deviceId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return agentActionRepository.findByDeviceIdOrderByRequestedAtDesc(
                        deviceId, PageRequest.of(0, safeLimit))
                .stream()
                .map(AgentActionResponseDTO::fromEntity)
                .toList();
    }

    private void createApprovedAlert(AgentAction action) {
        Telemetry latest = telemetryRepository.findFirstByDeviceIdOrderByRecordedAtDesc(action.getDeviceId())
                .orElse(null);

        alertService.createAlert(AlertRequestDTO.builder()
                .deviceId(action.getDeviceId())
                .alertType(AlertType.AGENT_RECOMMENDATION)
                .severity(toAlertSeverity(action.getRiskLevel()))
                .message(limit("Recomendação aprovada pelo familiar: " + action.getSummary()
                        + " Justificativa: " + action.getJustification(), 240))
                .latitude(latest == null ? null : latest.getLatitude())
                .longitude(latest == null ? null : latest.getLongitude())
                .batteryLevel(latest == null ? null : latest.getBatteryPercent())
                .build());
    }

    private AgentPlan parsePlan(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            String summary = requiredText(root, "summary");
            String justification = requiredText(root, "justification");
            AgentRiskLevel risk = enumValue(
                    AgentRiskLevel.class, requiredText(root, "riskLevel"), AgentRiskLevel.MEDIUM);
            AgentActionType action = enumValue(
                    AgentActionType.class, requiredText(root, "proposedAction"), AgentActionType.CHECK_PERSON);
            return new AgentPlan(summary, risk, action, justification);
        } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException("A IA local retornou um plano inválido", exception);
        }
    }

    private String requiredText(JsonNode root, String field) {
        JsonNode value = root.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) {
            throw new IllegalArgumentException("Campo ausente no plano: " + field);
        }
        return value.asText().trim();
    }

    private <T extends Enum<T>> T enumValue(Class<T> enumType, String value, T safeFallback) {
        try {
            return Enum.valueOf(enumType, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return safeFallback;
        }
    }

    private AlertSeverity toAlertSeverity(AgentRiskLevel risk) {
        return switch (risk) {
            case LOW -> AlertSeverity.INFO;
            case MEDIUM, HIGH -> AlertSeverity.WARNING;
            case CRITICAL -> AlertSeverity.CRITICAL;
        };
    }

    private String buildContext(
            String deviceId,
            String objective,
            List<Telemetry> telemetry,
            List<Alert> alerts) {
        StringBuilder context = new StringBuilder();
        context.append("Dispositivo: ").append(deviceId).append('\n');
        context.append("Objetivo: ").append(objective).append("\n\n");
        context.append("Telemetrias, da mais nova para a mais antiga:\n");

        if (telemetry.isEmpty()) {
            context.append("- nenhuma telemetria disponível\n");
        } else {
            telemetry.forEach(item -> context.append(String.format(Locale.ROOT,
                    "- instante=%s; bateria=%s; velocidade=%s; obstáculo=%s; "
                            + "obstáculoDetectado=%s; quedaDetectada=%s; latitude=%s; longitude=%s%n",
                    value(item.getRecordedAt()), value(item.getBatteryPercent()),
                    value(item.getSpeedKmh()), value(item.getObstacleDistanceCm()),
                    value(item.getObstacleDetected()), value(item.getFallDetected()),
                    value(item.getLatitude()), value(item.getLongitude()))));
        }

        context.append("\nAlertas:\n");
        if (alerts.isEmpty()) {
            context.append("- nenhum alerta disponível\n");
        } else {
            alerts.forEach(alert -> context.append(String.format(Locale.ROOT,
                    "- instante=%s; tipo=%s; gravidade=%s; status=%s; mensagem=%s%n",
                    value(alert.getCreatedAt()), value(alert.getAlertType()),
                    value(alert.getSeverity()), value(alert.getStatus()), value(alert.getMessage()))));
        }

        return context.toString();
    }

    private String limit(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength - 1) + "…";
    }

    private String value(Object value) {
        return value == null ? "não informado" : value.toString();
    }

    private record AgentPlan(
            String summary,
            AgentRiskLevel riskLevel,
            AgentActionType actionType,
            String justification) {
    }
}
