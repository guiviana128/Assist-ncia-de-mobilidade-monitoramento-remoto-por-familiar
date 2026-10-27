package com.assistmob.controller;

import com.assistmob.dto.AiAnalysisRequestDTO;
import com.assistmob.dto.AiAnalysisResponseDTO;
import com.assistmob.dto.AiStatusDTO;
import com.assistmob.service.AiAnalysisService;
import com.assistmob.service.OllamaClient;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AiController {

    private final AiAnalysisService aiAnalysisService;
    private final OllamaClient ollamaClient;

    @GetMapping("/status")
    public ResponseEntity<AiStatusDTO> status() {
        boolean available = ollamaClient.isAvailable();
        return ResponseEntity.ok(AiStatusDTO.builder()
                .available(available)
                .provider("ollama-local")
                .model(ollamaClient.getConfiguredModel())
                .message(available
                        ? "IA local disponível"
                        : "Ollama indisponível. Inicie-o com docker compose up -d.")
                .build());
    }

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalysisResponseDTO> analyze(
            @Valid @RequestBody AiAnalysisRequestDTO request) {
        return ResponseEntity.ok(aiAnalysisService.analyze(request));
    }

    @ExceptionHandler({RestClientException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> handleAiUnavailable(RuntimeException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", "local_ai_unavailable",
                "message", "A IA local não respondeu. Verifique o Ollama e o modelo configurado."
        ));
    }
}
