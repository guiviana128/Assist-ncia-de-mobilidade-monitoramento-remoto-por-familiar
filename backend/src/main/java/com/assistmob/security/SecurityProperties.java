package com.assistmob.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * Configuração de segurança (correção das vulnerabilidades do pentest, ver docs/PENTEST.md).
 * Todos os valores podem (e devem) ser trocados por variáveis de ambiente fora do ambiente de aula.
 */
@Component
public class SecurityProperties {

    static final String DEFAULT_DEVICE_KEY = "dev-device-key-troque-em-producao";
    static final String DEFAULT_FAMILY_PASSWORD = "amparo2050";

    @Value("${assistmob.security.enabled:true}")
    private boolean enabled;

    @Value("${assistmob.security.device-api-key:" + DEFAULT_DEVICE_KEY + "}")
    private String deviceApiKey;

    @Value("${assistmob.security.family-username:familia}")
    private String familyUsername;

    @Value("${assistmob.security.family-password:" + DEFAULT_FAMILY_PASSWORD + "}")
    private String familyPassword;

    @Value("${assistmob.security.token-ttl-minutes:480}")
    private long tokenTtlMinutes;

    @Value("${assistmob.security.cors-origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String corsOrigins;

    public boolean isEnabled() {
        return enabled;
    }

    public String getDeviceApiKey() {
        return deviceApiKey;
    }

    public String getFamilyUsername() {
        return familyUsername;
    }

    public String getFamilyPassword() {
        return familyPassword;
    }

    public long getTokenTtlMinutes() {
        return tokenTtlMinutes;
    }

    public List<String> getCorsOrigins() {
        return Arrays.stream(corsOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
    }

    public boolean usesDefaultSecrets() {
        return DEFAULT_DEVICE_KEY.equals(deviceApiKey) || DEFAULT_FAMILY_PASSWORD.equals(familyPassword);
    }
}
