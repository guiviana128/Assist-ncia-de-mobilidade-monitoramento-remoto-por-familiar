package com.assistmob.monitoring;

import com.assistmob.dto.AlertResponseDTO;
import com.assistmob.family.*;
import com.assistmob.model.*;
import com.assistmob.model.enums.*;
import com.assistmob.repository.*;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/care")
public class CareController {
  private final FamilyAccess access;
  private final DeviceBindings bindings;
  private final AlertRepository alerts;
  private final VisionDetectionEventRepository vision;
  private final AgentActionRepository actions;
  private final DeviceRepository devices;
  private final Heartbeats beats;
  private final MonitoringService monitor;
  private final AccountService accounts;
  private final com.assistmob.service.RobotMissionService robots;

  public CareController(
      FamilyAccess a,
      DeviceBindings b,
      AlertRepository ar,
      VisionDetectionEventRepository v,
      AgentActionRepository ac,
      DeviceRepository d,
      Heartbeats h,
      MonitoringService m,
      AccountService accounts,
      com.assistmob.service.RobotMissionService robots) {
    access = a;
    bindings = b;
    alerts = ar;
    vision = v;
    actions = ac;
    devices = d;
    beats = h;
    monitor = m;
    this.accounts = accounts;
    this.robots = robots;
  }

  @PostMapping("/invite")
  public Object invite() {
    return Map.of("invite", accounts.invite(access.family()), "expiresInHours", 24);
  }

  @PostMapping("/recovery-code")
  public Object recoveryCode() {
    access.family();
    return Map.of("recoveryCode", accounts.rotateRecovery(access.actor()));
  }

  @GetMapping("/devices")
  public Object devices() {
    return access.devices().stream()
        .map(
            b ->
                Map.of(
                    "deviceId",
                    b.getDeviceId(),
                    "robotId",
                    b.getRobotId(),
                    "personName",
                    b.getPersonName()))
        .toList();
  }

  @PostMapping("/devices/{deviceId}/key")
  @Transactional
  public Object rotate(@PathVariable String deviceId) {
    access.family();
    access.device(deviceId);
    String key = Secrets.token();
    var b = bindings.findById(deviceId).orElseThrow();
    b.setKeyHash(Secrets.digest(key));
    bindings.save(b);
    return Map.of("deviceKey", key);
  }

  @GetMapping("/{deviceId}/alerts")
  public Object alerts(@PathVariable String deviceId, @RequestParam(defaultValue = "0") int page) {
    return alerts
        .findByDeviceIdOrderByCreatedAtDesc(deviceId, PageRequest.of(Math.max(0, page), 50))
        .stream()
        .map(AlertResponseDTO::fromEntity)
        .toList();
  }

  @GetMapping("/{deviceId}/vision")
  public Object vision(@PathVariable String deviceId, @RequestParam(defaultValue = "0") int page) {
    return vision.findByDeviceIdOrderByReceivedAtDesc(
        deviceId, PageRequest.of(Math.max(0, page), 50));
  }

  @PatchMapping("/{deviceId}/vision/{eventId}/review")
  @Transactional
  public Object review(
      @PathVariable String deviceId, @PathVariable String eventId, @RequestParam String decision) {
    if (!Set.of("FALSE_POSITIVE", "CONFIRMED", "CANCELED").contains(decision))
      throw new IllegalArgumentException("Decisão inválida");
    var e = vision.findByEventId(eventId).orElseThrow(FamilyAccess::denied);
    if (!deviceId.equals(e.getDeviceId())) throw FamilyAccess.denied();
    if (e.getReviewedAt() != null) throw new IllegalArgumentException("Evento já revisado");
    e.setReviewedAt(LocalDateTime.now());
    e.setReviewedBy(access.actor());
    e.setReviewDecision(decision);
    if (!decision.equals("CONFIRMED")) {
      if (e.getAgentActionId() != null)
        actions
            .findById(e.getAgentActionId())
            .filter(a -> a.getStatus() == AgentActionStatus.PENDING_APPROVAL)
            .ifPresent(
                a -> {
                  a.setStatus(AgentActionStatus.REJECTED);
                  a.setReviewedBy(access.actor());
                  a.setReviewedAt(LocalDateTime.now());
                  actions.save(a);
                });
      if (e.getAlertId() != null)
        alerts
            .findById(e.getAlertId())
            .ifPresent(
                a -> {
                  a.setStatus(AlertStatus.RESOLVED);
                  a.setResolvedBy(access.actor());
                  a.setResolvedAt(LocalDateTime.now());
                  alerts.save(a);
                });
    }
    return vision.save(e);
  }

  @PostMapping("/{deviceId}/heartbeat/{component}")
  public Object heartbeat(
      @PathVariable String deviceId,
      @PathVariable String component,
      @RequestParam(defaultValue = "ACTIVE") String state) {
    if (!Set.of("camera", "vision", "robot").contains(component)
        || !Set.of("ACTIVE", "ERROR", "STOPPED").contains(state))
      throw new IllegalArgumentException("Estado inválido");
    var h = new Heartbeat();
    h.setId(deviceId + ":" + component);
    h.setDeviceId(deviceId);
    h.setComponent(component);
    h.setReceivedAt(Instant.now());
    h.setState(state);
    beats.save(h);
    return Map.of("accepted", true);
  }

  @GetMapping("/{deviceId}/connections")
  public Object connections(@PathVariable String deviceId) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (String c : List.of("camera", "vision", "robot")) {
      var h = beats.findById(deviceId + ":" + c);
      result.put(
          c,
          h.map(
                  x ->
                      Map.of(
                          "online",
                          x.getState().equals("ACTIVE")
                              && x.getReceivedAt().isAfter(Instant.now().minusSeconds(20)),
                          "lastSeen",
                          x.getReceivedAt().toString(),
                          "state",
                          x.getState()))
              .orElse(Map.of("online", false, "state", "UNKNOWN", "lastSeen", "")));
    }
    var binding = bindings.findById(deviceId).orElseThrow();
    var robot = robots.getState(binding.getRobotId());
    result.put(
        "robot",
        Map.of(
            "online",
            robot.online(),
            "lastSeen",
            robot.lastUpdate() == null ? "" : robot.lastUpdate().toString()));
    var d = devices.findById(deviceId).orElseThrow();
    result.put(
        "cane",
        Map.of(
            "online",
            d.getLastPingAt() != null
                && d.getLastPingAt().isAfter(LocalDateTime.now().minusMinutes(2)),
            "lastSeen",
            d.getLastPingAt() == null ? "" : d.getLastPingAt().toString()));
    return result;
  }

  @GetMapping("/{deviceId}/reports")
  public Object reports(@PathVariable String deviceId) {
    return monitor.history(deviceId);
  }

  @PostMapping("/{deviceId}/analyze")
  public Object analyze(@PathVariable String deviceId) {
    return monitor.analyze(deviceId);
  }
}
