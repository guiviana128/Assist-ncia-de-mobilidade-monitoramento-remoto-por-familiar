package com.assistmob.service;

import com.assistmob.dto.AlertRequestDTO;
import com.assistmob.dto.AlertResponseDTO;
import com.assistmob.event.AlertCreatedEvent;
import com.assistmob.model.Alert;
import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertStatus;
import com.assistmob.repository.AlertRepository;
import com.assistmob.repository.DeviceRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AlertService {

  private static final Logger log = LoggerFactory.getLogger(AlertService.class);

  private final AlertRepository alertRepository;
  private final DeviceRepository deviceRepository;
  private final FcmNotificationService fcmNotificationService;
  private final HouseLayoutService houseLayoutService;
  private final PersonLocationTracker personLocationTracker;
  private final ApplicationEventPublisher eventPublisher;
  private final com.assistmob.family.FamilyAccess access;
  private final com.assistmob.family.DeviceBindings bindings;
  private final com.assistmob.family.FamilyAccounts accounts;
  private final com.assistmob.repository.UserRepository users;

  @Transactional
  public AlertResponseDTO createAlert(AlertRequestDTO dto) {
    log.warn(
        "🚨 [ALERTA RECEBIDO] Dispositivo: {}, Tipo: {}, Severidade: {}",
        dto.getDeviceId(),
        dto.getAlertType(),
        dto.getSeverity());

    var repeated =
        alertRepository
            .findByDeviceIdOrderByCreatedAtDesc(dto.getDeviceId(), PageRequest.of(0, 50))
            .stream()
            .filter(
                a -> a.getAlertType() == dto.getAlertType() && a.getStatus() == AlertStatus.PENDING)
            .findFirst();
    if (repeated.isPresent()
        && java.util.Set.of(
                com.assistmob.model.enums.AlertType.LOW_BATTERY,
                com.assistmob.model.enums.AlertType.DEVICE_OFFLINE,
                com.assistmob.model.enums.AlertType.GEOFENCE_EXIT)
            .contains(dto.getAlertType())) return AlertResponseDTO.fromEntity(repeated.get());
    Alert alert =
        Alert.builder()
            .deviceId(dto.getDeviceId())
            .alertType(dto.getAlertType())
            .severity(dto.getSeverity() != null ? dto.getSeverity() : AlertSeverity.CRITICAL)
            .status(AlertStatus.PENDING)
            .message(dto.getMessage())
            .latitude(dto.getLatitude())
            .longitude(dto.getLongitude())
            .batteryLevel(dto.getBatteryLevel())
            .indoorRoom(
                houseLayoutService
                    .findRoom(dto.getIndoorRoom())
                    .map(room -> room.id())
                    .orElse(null))
            .createdAt(LocalDateTime.now())
            .build();

    alert.setNotificationState("INBOX_ONLY");
    Alert saved = alertRepository.save(alert);
    personLocationTracker.update(saved.getDeviceId(), saved.getIndoorRoom());

    // Observer: avisa quem estiver interessado (ex.: o robô assistente) sem acoplar os serviços.
    eventPublisher.publishEvent(new AlertCreatedEvent(saved));

    bindings
        .findById(dto.getDeviceId())
        .ifPresent(
            binding -> {
              for (var account : accounts.findByFamilyId(binding.getFamilyId())) {
                users
                    .findByEmail(account.getEmail())
                    .filter(user -> user.getFcmToken() != null && !user.getFcmToken().isBlank())
                    .ifPresent(
                        user -> {
                          String result =
                              fcmNotificationService.sendPushAlert(user.getFcmToken(), saved);
                          if (!"PROVIDER_ACCEPTED".equals(saved.getNotificationState()))
                            saved.setNotificationState(result);
                        });
              }
            });

    return AlertResponseDTO.fromEntity(saved);
  }

  public List<AlertResponseDTO> getRecentAlerts(String deviceId, int limit) {
    return alertRepository
        .findByDeviceIdOrderByCreatedAtDesc(deviceId, PageRequest.of(0, limit))
        .stream()
        .map(AlertResponseDTO::fromEntity)
        .collect(Collectors.toList());
  }

  public List<AlertResponseDTO> getPendingAlerts() {
    return alertRepository.findByStatusOrderByCreatedAtDesc(AlertStatus.PENDING).stream()
        .filter(a -> access.canRead(a.getDeviceId()))
        .map(AlertResponseDTO::fromEntity)
        .collect(Collectors.toList());
  }

  @Transactional
  public AlertResponseDTO acknowledge(Long id) {
    Alert a = alertRepository.findById(id).orElseThrow();
    if (a.getStatus() != AlertStatus.PENDING)
      throw new IllegalArgumentException("Alerta já encerrado");
    if (a.getAcknowledgedAt() == null) {
      a.setAcknowledgedAt(LocalDateTime.now());
      a.setAcknowledgedBy(access.actor());
      alertRepository.save(a);
    }
    return AlertResponseDTO.fromEntity(a);
  }

  @Transactional
  public AlertResponseDTO resolveAlert(Long alertId, String resolvedBy) {
    Alert alert =
        alertRepository
            .findById(alertId)
            .orElseThrow(() -> new IllegalArgumentException("Alerta não encontrado: " + alertId));

    alert.setStatus(AlertStatus.RESOLVED);
    alert.setResolvedAt(LocalDateTime.now());
    alert.setResolvedBy(access.actor());

    Alert updated = alertRepository.save(alert);
    return AlertResponseDTO.fromEntity(updated);
  }
}
