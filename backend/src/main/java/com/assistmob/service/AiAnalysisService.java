package com.assistmob.service;

import com.assistmob.dto.AiAnalysisRequestDTO;
import com.assistmob.dto.AiAnalysisResponseDTO;
import com.assistmob.model.Alert;
import com.assistmob.model.Telemetry;
import com.assistmob.repository.AlertRepository;
import com.assistmob.repository.TelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AiAnalysisService {

    private static final String SYSTEM_PROMPT = """
            Você é o assistente local de segurança do projeto AssistMob.
            Responda em português do Brasil, de forma curta, objetiva e acolhedora.
            Use somente os dados fornecidos no contexto. Se faltarem dados, diga claramente.
            Não invente localização, diagnóstico, sensor ou evento.
            Não substitua avaliação médica. Em risco imediato, queda ou SOS pendente,
            oriente o familiar a verificar a pessoa e acionar o SAMU 192 quando necessário.
            Diferencie observações dos sensores de conclusões.
            """;

    private final TelemetryRepository telemetryRepository;
    private final AlertRepository alertRepository;
    private final OllamaClient ollamaClient;

    public AiAnalysisResponseDTO analyze(AiAnalysisRequestDTO request) {
        int limit = request.getTelemetryLimit() == null ? 10 : request.getTelemetryLimit();
        List<Telemetry> telemetry = telemetryRepository.findByDeviceIdOrderByRecordedAtDesc(
                request.getDeviceId(), PageRequest.of(0, limit));
        List<Alert> alerts = alertRepository.findByDeviceIdOrderByCreatedAtDesc(
                request.getDeviceId(), PageRequest.of(0, 10));

        String question = request.getQuestion() == null || request.getQuestion().isBlank()
                ? "Faça um resumo do estado atual e destaque riscos ou ações recomendadas."
                : request.getQuestion().trim();

        OllamaClient.Generation generation = ollamaClient.chat(
                SYSTEM_PROMPT,
                buildPrompt(request.getDeviceId(), question, telemetry, alerts));

        return AiAnalysisResponseDTO.builder()
                .deviceId(request.getDeviceId())
                .answer(generation.answer())
                .provider("ollama-local")
                .model(generation.model())
                .generatedAt(LocalDateTime.now())
                .telemetrySamples(telemetry.size())
                .alertSamples(alerts.size())
                .build();
    }

    private String buildPrompt(
            String deviceId,
            String question,
            List<Telemetry> telemetry,
            List<Alert> alerts) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Dispositivo: ").append(deviceId).append('\n');
        prompt.append("Pergunta do familiar: ").append(question).append("\n\n");
        prompt.append("Telemetrias mais recentes (da mais nova para a mais antiga):\n");

        if (telemetry.isEmpty()) {
            prompt.append("- Nenhuma telemetria encontrada.\n");
        } else {
            telemetry.forEach(item -> prompt.append(String.format(Locale.ROOT,
                    "- instante=%s; bateria=%s%%; velocidade=%s km/h; obstáculo=%s cm; "
                            + "obstáculoDetectado=%s; quedaDetectada=%s; latitude=%s; longitude=%s%n",
                    value(item.getRecordedAt()),
                    value(item.getBatteryPercent()),
                    value(item.getSpeedKmh()),
                    value(item.getObstacleDistanceCm()),
                    value(item.getObstacleDetected()),
                    value(item.getFallDetected()),
                    value(item.getLatitude()),
                    value(item.getLongitude()))));
        }

        prompt.append("\nAlertas mais recentes:\n");
        if (alerts.isEmpty()) {
            prompt.append("- Nenhum alerta encontrado.\n");
        } else {
            alerts.forEach(alert -> prompt.append(String.format(Locale.ROOT,
                    "- instante=%s; tipo=%s; gravidade=%s; status=%s; mensagem=%s%n",
                    value(alert.getCreatedAt()),
                    value(alert.getAlertType()),
                    value(alert.getSeverity()),
                    value(alert.getStatus()),
                    value(alert.getMessage()))));
        }

        return prompt.toString();
    }

    private String value(Object value) {
        return value == null ? "não informado" : value.toString();
    }
}
