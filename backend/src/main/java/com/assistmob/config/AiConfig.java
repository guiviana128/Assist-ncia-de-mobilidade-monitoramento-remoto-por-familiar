package com.assistmob.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class AiConfig {

    @Bean("ollamaRestClient")
    public RestClient ollamaRestClient(
            RestClient.Builder builder,
            @Value("${assistmob.ai.base-url:http://localhost:11434}") String baseUrl) {
        return builder.baseUrl(baseUrl).build();
    }
}
