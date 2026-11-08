package com.assistmob.monitoring;

import com.assistmob.dto.AlertRequestDTO;
import com.assistmob.family.*;
import com.assistmob.model.enums.*;
import com.assistmob.repository.*;
import com.assistmob.service.AlertService;
import com.fasterxml.jackson.databind.*;
import java.time.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SafetyRules {
  private final DeviceRepository devices;
  private final DeviceBindings bindings;
  private final CarePreferencesRepository prefs;
  private final ReminderDeliveries deliveries;
  private final AlertService alerts;
  private final ObjectMapper json;

  public SafetyRules(
      DeviceRepository d,
      DeviceBindings b,
      CarePreferencesRepository p,
      ReminderDeliveries rd,
      AlertService a,
      ObjectMapper j) {
    devices = d;
    bindings = b;
    prefs = p;
    deliveries = rd;
    alerts = a;
    json = j;
  }

  public boolean outsideConfiguredAreas(String device, double lat, double lng) {
    try {
      var b = bindings.findById(device);
      if (b.isEmpty()) return false;
      var p = prefs.findById(b.get().getFamilyId());
      if (p.isEmpty()) return false;
      boolean configured = false;
      for (var area : json.readTree(p.get().getSettings()).path("areas")) {
        if (!area.path("ativa").asBoolean()) continue;
        configured = true;
        double distance =
            distance(lat, lng, area.path("lat").asDouble(), area.path("lng").asDouble());
        if (distance <= area.path("raio").asDouble(500)) return false;
      }
      return configured;
    } catch (Exception e) {
      return false;
    }
  }

  private double distance(double a, double b, double c, double d) {
    double x = Math.sin(Math.toRadians(c - a) / 2), y = Math.sin(Math.toRadians(d - b) / 2);
    return 6371000
        * 2
        * Math.asin(
            Math.min(
                1,
                Math.sqrt(
                    x * x + Math.cos(Math.toRadians(a)) * Math.cos(Math.toRadians(c)) * y * y)));
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 30000)
  @Transactional
  public void tick() {
    var now = LocalDateTime.now(ZoneId.of("America/Sao_Paulo"));
    for (var b : bindings.findAll()) {
      var d = devices.findById(b.getDeviceId());
      if (d.isPresent()
          && d.get().getLastPingAt() != null
          && d.get().getLastPingAt().isBefore(LocalDateTime.now().minusMinutes(2)))
        alerts.createAlert(
            AlertRequestDTO.builder()
                .deviceId(b.getDeviceId())
                .alertType(AlertType.DEVICE_OFFLINE)
                .severity(AlertSeverity.WARNING)
                .message(
                    "A bengala está sem atualização há mais de dois minutos. Verifique a conexão.")
                .build());
      try {
        var p = prefs.findById(b.getFamilyId());
        if (p.isEmpty()) continue;
        for (var med : json.readTree(p.get().getSettings()).path("remedios")) {
          if (!med.path("ativo").asBoolean()) continue;
          var time = LocalTime.parse(med.path("hora").asText());
          if (time.isAfter(now.toLocalTime())) continue;
          String id = b.getDeviceId() + ":" + med.path("id").asText() + ":" + now.toLocalDate();
          if (deliveries.existsById(id)) continue;
          deliveries.save(new ReminderDelivery(id));
          alerts.createAlert(
              AlertRequestDTO.builder()
                  .deviceId(b.getDeviceId())
                  .alertType(AlertType.MEDICATION_REMINDER)
                  .severity(AlertSeverity.INFO)
                  .message("Lembrete cadastrado pela família: " + med.path("nome").asText())
                  .build());
        }
      } catch (Exception e) {
        org.slf4j.LoggerFactory.getLogger(getClass())
            .warn("Preferências de lembrete inválidas para um dispositivo");
      }
    }
  }
}
