package com.assistmob.monitoring;

import com.assistmob.family.*;
import com.assistmob.model.enums.*;
import com.assistmob.repository.*;
import com.assistmob.service.PersonLocationTracker;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/care")
public class MonitoringSummaryController {
  private final FamilyAccess access;
  private final DeviceBindings bindings;
  private final TelemetryRepository telemetry;
  private final AlertRepository alerts;
  private final PersonLocationTracker tracker;

  public MonitoringSummaryController(
      FamilyAccess access,
      DeviceBindings bindings,
      TelemetryRepository telemetry,
      AlertRepository alerts,
      PersonLocationTracker tracker) {
    this.access = access;
    this.bindings = bindings;
    this.telemetry = telemetry;
    this.alerts = alerts;
    this.tracker = tracker;
  }

  @GetMapping("/{deviceId}/summary")
  public Object summary(@PathVariable String deviceId) {
    access.device(deviceId);
    var b = bindings.findById(deviceId).orElseThrow(FamilyAccess::denied);
    var readings = telemetry.findByDeviceIdOrderByRecordedAtDesc(deviceId, PageRequest.of(0, 1));
    var result = new LinkedHashMap<String, Object>();
    result.put("personName", b.getPersonName());
    result.put("source", "Telemetria da bengala");
    var now = LocalDateTime.now();
    var last = readings.isEmpty() ? null : readings.get(0);
    boolean emergency =
        alerts.existsByDeviceIdAndStatusNotAndAlertTypeIn(
            deviceId,
            AlertStatus.RESOLVED,
            Set.of(AlertType.FALL_DETECTED, AlertType.SOS_BUTTON, AlertType.HAND_GESTURE_SOS));
    String state =
        emergency
            ? "EMERGENCY"
            : last == null
                ? "WAITING"
                : last.getRecordedAt().isBefore(now.minusMinutes(2))
                    ? "STALE"
                    : last.getSpeedKmh() != null
                            && Float.isFinite(last.getSpeedKmh())
                            && last.getSpeedKmh() > 0.5f
                        ? "MOVEMENT"
                        : "OBSERVED";
    result.put("state", state);
    if (last != null)
      result.put(
          "observedAt", last.getRecordedAt().atZone(ZoneId.systemDefault()).toInstant().toString());
    tracker
        .lastSighting(deviceId)
        .filter(s -> s.seenAt().isAfter(now.minusMinutes(2)))
        .ifPresent(s -> result.put("room", s.roomId()));
    return result;
  }
}
