package com.assistmob.service;

import com.assistmob.dto.AlertRequestDTO;
import com.assistmob.dto.TelemetryRequestDTO;
import com.assistmob.model.Device;
import com.assistmob.model.Telemetry;
import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertType;
import com.assistmob.repository.DeviceRepository;
import com.assistmob.repository.TelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TelemetryService {

    private static final Logger log = LoggerFactory.getLogger(TelemetryService.class);

    private final TelemetryRepository telemetryRepository;
    private final DeviceRepository deviceRepository;
    private final AlertService alertService;

    @Value("${assistmob.geofence.safe-zone-latitude:-23.550520}")
    private Double safeZoneLat;

    @Value("${assistmob.geofence.safe-zone-longitude:-46.633308}")
    private Double safeZoneLng;

    @Value("${assistmob.geofence.default-radius-meters:500.0}")
    private Double safeRadiusMeters;

    @Transactional
    public Telemetry processTelemetry(TelemetryRequestDTO dto) {
        log.info("[TELEMETRIA] Dispositivo: {}, Lat: {}, Lng: {}, Bat: {}%, Dist: {}cm",
                dto.getDeviceId(), dto.getLatitude(), dto.getLongitude(),
                dto.getBatteryPercent(), dto.getObstacleDistanceCm());

        // 1. Salvar histórico de telemetria
        Telemetry telemetry = Telemetry.builder()
                .deviceId(dto.getDeviceId())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .speedKmh(dto.getSpeedKmh())
                .satellites(dto.getSatellites())
                .obstacleDistanceCm(dto.getObstacleDistanceCm())
                .obstacleDetected(dto.getObstacleDetected())
                .batteryPercent(dto.getBatteryPercent())
                .fallDetected(dto.getFallDetected())
                .recordedAt(LocalDateTime.now())
                .build();

        Telemetry saved = telemetryRepository.save(telemetry);

        // 2. Atualizar status instantâneo do dispositivo
        Device device = deviceRepository.findByDeviceId(dto.getDeviceId())
                .orElseGet(() -> Device.builder()
                        .deviceId(dto.getDeviceId())
                        .name("Dispositivo " + dto.getDeviceId())
                        .build());

        device.setOnline(true);
        device.setLastLatitude(dto.getLatitude());
        device.setLastLongitude(dto.getLongitude());
        device.setLastBatteryPercent(dto.getBatteryPercent());
        device.setLastPingAt(LocalDateTime.now());
        deviceRepository.save(device);

        // 3. Regras automáticas de segurança

        // 3.1 Queda detectada nos sensores
        if (Boolean.TRUE.equals(dto.getFallDetected())) {
            alertService.createAlert(AlertRequestDTO.builder()
                    .deviceId(dto.getDeviceId())
                    .alertType(AlertType.FALL_DETECTED)
                    .severity(AlertSeverity.CRITICAL)
                    .message("Queda detectada pelo acelerômetro MPU6050!")
                    .latitude(dto.getLatitude())
                    .longitude(dto.getLongitude())
                    .batteryLevel(dto.getBatteryPercent())
                    .build());
        }

        // 3.2 Bateria baixa (< 15%)
        if (dto.getBatteryPercent() != null && dto.getBatteryPercent() < 15.0f) {
            alertService.createAlert(AlertRequestDTO.builder()
                    .deviceId(dto.getDeviceId())
                    .alertType(AlertType.LOW_BATTERY)
                    .severity(AlertSeverity.WARNING)
                    .message(String.format("Bateria em nível crítico: %.0f%%", dto.getBatteryPercent()))
                    .latitude(dto.getLatitude())
                    .longitude(dto.getLongitude())
                    .batteryLevel(dto.getBatteryPercent())
                    .build());
        }

        // 3.3 Verificação de Geofence (Cerca Virtual)
        if (dto.getLatitude() != null && dto.getLongitude() != null) {
            double distanceToSafeZone = calculateDistanceMeters(dto.getLatitude(), dto.getLongitude(), safeZoneLat, safeZoneLng);
            if (distanceToSafeZone > safeRadiusMeters) {
                alertService.createAlert(AlertRequestDTO.builder()
                        .deviceId(dto.getDeviceId())
                        .alertType(AlertType.GEOFENCE_EXIT)
                        .severity(AlertSeverity.WARNING)
                        .message(String.format("Usuário saiu do perímetro de segurança (Distância: %.0fm)", distanceToSafeZone))
                        .latitude(dto.getLatitude())
                        .longitude(dto.getLongitude())
                        .batteryLevel(dto.getBatteryPercent())
                        .build());
            }
        }

        return saved;
    }

    public List<Telemetry> getRouteHistory(String deviceId, int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return telemetryRepository.findRecentRoute(deviceId, since);
    }

    public List<Telemetry> getRecentReadings(String deviceId, int limit) {
        return telemetryRepository.findByDeviceIdOrderByRecordedAtDesc(deviceId, PageRequest.of(0, limit));
    }

    // Fórmula de Haversine para cálculo de distância em metros entre duas coordenadas GPS
    private double calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000; // Raio da Terra em metros
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
