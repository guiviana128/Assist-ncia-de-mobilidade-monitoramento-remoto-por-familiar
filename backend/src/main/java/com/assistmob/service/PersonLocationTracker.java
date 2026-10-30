package com.assistmob.service;

import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Guarda o último cômodo conhecido de cada usuário da bengala.
 * Dentro de casa o GPS não serve, então a bengala/simulador informa o cômodo (campo indoorRoom),
 * por exemplo a partir de beacons BLE em cada cômodo.
 */
@Component
public class PersonLocationTracker {

    public record Sighting(String roomId, LocalDateTime seenAt) {
    }

    private final Map<String, Sighting> lastSeen = new ConcurrentHashMap<>();

    public void update(String deviceId, String roomId) {
        if (deviceId != null && roomId != null && !roomId.isBlank()) {
            lastSeen.put(deviceId, new Sighting(roomId.trim().toLowerCase(), LocalDateTime.now()));
        }
    }

    public Optional<Sighting> lastSighting(String deviceId) {
        return Optional.ofNullable(lastSeen.get(deviceId));
    }

    public Optional<Sighting> mostRecent() {
        return lastSeen.values().stream()
                .max((a, b) -> a.seenAt().compareTo(b.seenAt()));
    }
}
