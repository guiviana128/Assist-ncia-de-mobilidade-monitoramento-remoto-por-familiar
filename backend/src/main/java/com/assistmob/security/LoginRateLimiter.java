package com.assistmob.security;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Bloqueia força bruta no login: no máximo 5 tentativas erradas por IP a cada 5 minutos. */
@Component
public class LoginRateLimiter {

    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(5);

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public boolean isBlocked(String ip) {
        Deque<Instant> attempts = failures.get(ip);
        if (attempts == null) {
            return false;
        }
        synchronized (attempts) {
            prune(attempts);
            return attempts.size() >= MAX_FAILURES;
        }
    }

    public void recordFailure(String ip) {
        Deque<Instant> attempts = failures.computeIfAbsent(ip, key -> new ArrayDeque<>());
        synchronized (attempts) {
            prune(attempts);
            attempts.addLast(Instant.now());
        }
    }

    public void reset(String ip) {
        failures.remove(ip);
    }

    private static void prune(Deque<Instant> attempts) {
        Instant limit = Instant.now().minus(WINDOW);
        while (!attempts.isEmpty() && attempts.peekFirst().isBefore(limit)) {
            attempts.pollFirst();
        }
    }
}
