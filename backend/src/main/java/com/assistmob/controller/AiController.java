package com.assistmob.controller;

import com.assistmob.dto.AgentActionResponseDTO;
import com.assistmob.dto.AgentDecisionRequestDTO;
import com.assistmob.dto.AgentRunRequestDTO;
import com.assistmob.dto.AiAnalysisRequestDTO;
import com.assistmob.dto.AiAnalysisResponseDTO;
import com.assistmob.dto.AiStatusDTO;
import com.assistmob.service.AiAnalysisService;
import com.assistmob.service.OllamaClient;
import com.assistmob.service.SupervisedAgentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AiController {

    private final AiAnalysisService aiAnalysisService;
    private final SupervisedAgentService supervisedAgentService;
    private final OllamaClient ollamaClient;

    @GetMapping("/status")
    public ResponseEntity<AiStatusDTO> status() {
        boolean available = ollamaClient.isAvailable();
        return ResponseEntity.ok(AiStatusDTO.builder()
                .available(available)
                .provider("ollama-local")
                .model(ollamaClient.getConfiguredModel())
                .message(available
                        ? "Agente local supervisionado disponível"
                        : "Ollama indisponível. Inicie-o com docker compose up -d.")
                .build());
    }

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalysisResponseDTO> analyze(
            @Valid @RequestBody AiAnalysisRequestDTO request) {
        return ResponseEntity.ok(aiAnalysisService.analyze(request));
    }

    @PostMapping("/agent/run")
    public ResponseEntity<AgentActionResponseDTO> runAgent(
            @Valid @RequestBody AgentRunRequestDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(supervisedAgentService.run(request));
    }

    @GetMapping("/agent/actions/{actionId}")
    public ResponseEntity<AgentActionResponseDTO> getAgentAction(@PathVariable Long actionId) {
        return ResponseEntity.ok(supervisedAgentService.getById(actionId));
    }

    @GetMapping("/agent/actions/device/{deviceId}")
    public ResponseEntity<List<AgentActionResponseDTO>> getDeviceActions(
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(supervisedAgentService.getRecent(deviceId, limit));
    }

    @PatchMapping("/agent/actions/{actionId}/decision")
    public ResponseEntity<AgentActionResponseDTO> decideAgentAction(
            @PathVariable Long actionId,
            @Valid @RequestBody AgentDecisionRequestDTO request) {
        return ResponseEntity.ok(supervisedAgentService.decide(actionId, request));
    }

    @ExceptionHandler({RestClientException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> handleAiUnavailable(RuntimeException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", "local_ai_unavailable",
                "message", "A IA local não respondeu ou retornou um plano inválido."
        ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleInvalidRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of(
                "error", "invalid_agent_action",
                "message", exception.getMessage()
        ));
    }
}
