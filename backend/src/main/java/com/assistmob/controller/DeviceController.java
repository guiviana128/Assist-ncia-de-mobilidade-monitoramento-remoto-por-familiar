package com.assistmob.controller;

import com.assistmob.dto.AlertRequestDTO;
import com.assistmob.dto.DeviceStatusDTO;
import com.assistmob.model.enums.AlertSeverity;
import com.assistmob.model.enums.AlertType;
import com.assistmob.service.AlertService;
import com.assistmob.service.DeviceService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
public class DeviceController {

  private final DeviceService deviceService;
  private final AlertService alertService;

  @GetMapping
  public ResponseEntity<List<DeviceStatusDTO>> getAllDevices() {
    return ResponseEntity.ok(deviceService.getAllDevicesStatus());
  }

  @GetMapping("/{deviceId}")
  public ResponseEntity<DeviceStatusDTO> getDeviceStatus(@PathVariable String deviceId) {
    return deviceService
        .getDeviceStatus(deviceId)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  // Aciona o localizador sonoro e luminoso na bengala (Find My Cane)
  @PostMapping("/{deviceId}/find")
  public ResponseEntity<Map<String, String>> findCane(@PathVariable String deviceId) {
    return ResponseEntity.status(501)
        .body(
            Map.of(
                "status",
                "NOT_IMPLEMENTED",
                "message",
                "O comando físico de localização ainda não está integrado ao equipamento."));
  }

  // Agenda ou dispara lembrete de medicamento
  @PostMapping("/{deviceId}/reminder")
  public ResponseEntity<Map<String, String>> sendMedicationReminder(
      @PathVariable String deviceId, @RequestBody Map<String, String> payload) {
    String medName = payload.getOrDefault("medicineName", "Medicamento Diário");

    alertService.createAlert(
        AlertRequestDTO.builder()
            .deviceId(deviceId)
            .alertType(AlertType.MEDICATION_REMINDER)
            .severity(AlertSeverity.INFO)
            .message("⏰ Hora do remédio: " + medName)
            .build());

    return ResponseEntity.ok(
        Map.of(
            "status", "SUCCESS",
            "message", "Lembrete de medicamento disparado com sucesso!"));
  }
}
