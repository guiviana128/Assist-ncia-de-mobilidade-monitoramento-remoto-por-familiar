package com.assistmob.security;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sessões dos familiares: token aleatório de 256 bits, com validade, guardado só no servidor.
 * (Antes do pentest a API não tinha login nenhum.)
 */
@Service
public class TokenService {

    private record Session(String username, Instant expiresAt) {
    }

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final SecurityProperties properties;

    public TokenService(SecurityProperties properties) {
        this.properties = properties;
    }

    public boolean checkFamilyCredentials(String username, String password) {
        if (username == null || password == null) {
            return false;
        }
        // Comparação em tempo constante para não vazar informação por tempo de resposta
        boolean userOk = constantTimeEquals(username, properties.getFamilyUsername());
        boolean passOk = constantTimeEquals(password, properties.getFamilyPassword());
        return userOk & passOk;
    }

    public String issueToken(String username) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, new Session(username, Instant.now().plusSeconds(properties.getTokenTtlMinutes() * 60)));
        return token;
    }

    public Optional<String> validate(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        Session session = sessions.get(token);
        if (session == null) {
            return Optional.empty();
        }
        if (session.expiresAt().isBefore(Instant.now())) {
            sessions.remove(token);
            return Optional.empty();
        }
        return Optional.of(session.username());
    }

    public void revoke(String token) {
        if (token != null) {
            sessions.remove(token);
        }
    }

    public long ttlSeconds() {
        return properties.getTokenTtlMinutes() * 60;
    }

    static boolean constantTimeEquals(String a, String b) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] ha = digest.digest(a.getBytes(StandardCharsets.UTF_8));
            byte[] hb = MessageDigest.getInstance("SHA-256").digest(b.getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(ha, hb);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
