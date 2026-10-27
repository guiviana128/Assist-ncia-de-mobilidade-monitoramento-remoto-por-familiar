package com.assistmob.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class OllamaClient {

    private final RestClient restClient;
    private final String configuredModel;

    public OllamaClient(
            @Qualifier("ollamaRestClient") RestClient restClient,
            @Value("${assistmob.ai.model:llama3.2:3b}") String configuredModel) {
        this.restClient = restClient;
        this.configuredModel = configuredModel;
    }

    public boolean isAvailable() {
        try {
            restClient.get().uri("/api/tags").retrieve().toBodilessEntity();
            return true;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    public Generation chat(String systemPrompt, String userPrompt) {
        OllamaRequest request = new OllamaRequest(
                configuredModel,
                List.of(
                        new OllamaMessage("system", systemPrompt),
                        new OllamaMessage("user", userPrompt)
                ),
                false,
                Map.of("temperature", 0.2)
        );

        OllamaResponse response = restClient.post()
                .uri("/api/chat")
                .body(request)
                .retrieve()
                .body(OllamaResponse.class);

        if (response == null || response.message() == null
                || response.message().content() == null
                || response.message().content().isBlank()) {
            throw new IllegalStateException("Ollama retornou uma resposta vazia");
        }

        String responseModel = response.model() == null ? configuredModel : response.model();
        return new Generation(response.message().content().trim(), responseModel);
    }

    public String getConfiguredModel() {
        return configuredModel;
    }

    public record Generation(String answer, String model) {
    }

    private record OllamaMessage(String role, String content) {
    }

    private record OllamaRequest(
            String model,
            List<OllamaMessage> messages,
            boolean stream,
            Map<String, Object> options) {
    }

    private record OllamaResponse(String model, OllamaMessage message) {
    }
}
