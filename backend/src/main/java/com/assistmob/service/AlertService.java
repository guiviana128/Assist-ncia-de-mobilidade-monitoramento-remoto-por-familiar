package com.assistmob.service;

import com.assistmob.dto.AlertRequestDTO;
import com.assistmob.dto.AlertResponseDTO;
import com.assistmob.model.Alert;
import com.assistmob.model.Device;
import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertStatus;
import com.assistmob.repository.AlertRepository;
import com.assistmob.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    private final AlertRepository alertRepository;
    private final DeviceRepository deviceRepository;
    private final FcmNotificationService fcmNotificationService;

    @Transactional
    public AlertResponseDTO createAlert(AlertRequestDTO dto) {
        log.warn("🚨 [ALERTA RECEBIDO] Dispositivo: {}, Tipo: {}, Severidade: {}",
                dto.getDeviceId(), dto.getAlertType(), dto.getSeverity());

        Alert alert = Alert.builder()
                .deviceId(dto.getDeviceId())
                .alertType(dto.getAlertType())
                .severity(dto.getSeverity() != null ? dto.getSeverity() : AlertSeverity.CRITICAL)
                .status(AlertStatus.PENDING)
                .message(dto.getMessage())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .batteryLevel(dto.getBatteryLevel())
                .createdAt(LocalDateTime.now())
                .build();

        Alert saved = alertRepository.save(alert);

        // Notificar cuidadores / familiares registrados
        Optional<Device> deviceOpt = deviceRepository.findByDeviceId(dto.getDeviceId());
        if (deviceOpt.isPresent()) {
            Device device = deviceOpt.get();
            if (device.getGuardian() != null && device.getGuardian().getFcmToken() != null) {
                fcmNotificationService.sendPushAlert(device.getGuardian().getFcmToken(), saved);
            }
        }

        return AlertResponseDTO.fromEntity(saved);
    }

    public List<AlertResponseDTO> getRecentAlerts(String deviceId, int limit) {
        return alertRepository.findByDeviceIdOrderByCreatedAtDesc(deviceId, PageRequest.of(0, limit))
                .stream()
                .map(AlertResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public List<AlertResponseDTO> getPendingAlerts() {
        return alertRepository.findByStatusOrderByCreatedAtDesc(AlertStatus.PENDING)
                .stream()
                .map(AlertResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public AlertResponseDTO resolveAlert(Long alertId, String resolvedBy) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new IllegalArgumentException("Alerta não encontrado: " + alertId));

        alert.setStatus(AlertStatus.RESOLVED);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(resolvedBy != null ? resolvedBy : "Familiar");

        Alert updated = alertRepository.save(alert);
        return AlertResponseDTO.fromEntity(updated);
    }
}
