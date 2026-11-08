package com.assistmob.service;

import com.assistmob.dto.DashboardSummaryDTO;
import com.assistmob.dto.DeviceStatusDTO;
import com.assistmob.model.Device;
import com.assistmob.model.Telemetry;
import com.assistmob.repository.AlertRepository;
import com.assistmob.repository.DeviceRepository;
import com.assistmob.repository.TelemetryRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeviceService {

  private final DeviceRepository deviceRepository;
  private final TelemetryRepository telemetryRepository;
  private final AlertRepository alertRepository;
  private final AlertService alertService;
  private final com.assistmob.family.FamilyAccess access;

  public List<DeviceStatusDTO> getAllDevicesStatus() {
    return deviceRepository.findAll().stream()
        .filter(d -> access.canRead(d.getDeviceId()))
        .map(this::mapToStatusDTO)
        .collect(Collectors.toList());
  }

  public Optional<DeviceStatusDTO> getDeviceStatus(String deviceId) {
    return deviceRepository.findByDeviceId(deviceId).map(this::mapToStatusDTO);
  }

  public DashboardSummaryDTO getDashboardSummary() {
    List<Device> devices =
        deviceRepository.findAll().stream().filter(d -> access.canRead(d.getDeviceId())).toList();
    long total = devices.size();
    long online =
        devices.stream()
            .filter(
                d ->
                    d.getLastPingAt() != null
                        && d.getLastPingAt().isAfter(LocalDateTime.now().minusMinutes(2)))
            .count();
    long pendingAlerts = alertService.getPendingAlerts().size();

    return DashboardSummaryDTO.builder()
        .totalDevices(total)
        .onlineDevices(online)
        .pendingAlertsCount(pendingAlerts)
        .recentAlerts(
            java.util.stream.Stream.concat(
                    alertService.getPendingAlerts().stream(),
                    devices.stream()
                        .flatMap(d -> alertService.getRecentAlerts(d.getDeviceId(), 50).stream()))
                .collect(
                    java.util.stream.Collectors.toMap(
                        com.assistmob.dto.AlertResponseDTO::getId, a -> a, (a, b) -> a))
                .values()
                .stream()
                .sorted(
                    java.util.Comparator.comparing(com.assistmob.dto.AlertResponseDTO::getCreatedAt)
                        .reversed())
                .toList())
        .devices(devices.stream().map(this::mapToStatusDTO).collect(Collectors.toList()))
        .build();
  }

  private DeviceStatusDTO mapToStatusDTO(Device d) {
    Optional<Telemetry> lastTel =
        telemetryRepository.findFirstByDeviceIdOrderByRecordedAtDesc(d.getDeviceId());

    return DeviceStatusDTO.builder()
        .deviceId(d.getDeviceId())
        .name(d.getName())
        .isOnline(
            d.getLastPingAt() != null
                && d.getLastPingAt().isAfter(LocalDateTime.now().minusMinutes(2)))
        .currentLatitude(d.getLastLatitude())
        .currentLongitude(d.getLastLongitude())
        .batteryPercent(d.getLastBatteryPercent())
        .lastDistanceCm(lastTel.map(Telemetry::getObstacleDistanceCm).orElse(null))
        .obstacleAlert(lastTel.map(Telemetry::getObstacleDetected).orElse(false))
        .lastUpdate(d.getLastPingAt())
        .build();
  }
}
