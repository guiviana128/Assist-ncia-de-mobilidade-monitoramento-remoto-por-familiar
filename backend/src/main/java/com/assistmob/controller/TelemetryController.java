package com.assistmob.controller;

import com.assistmob.dto.TelemetryRequestDTO;
import com.assistmob.model.Telemetry;
import com.assistmob.service.TelemetryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TelemetryController {

    private final TelemetryService telemetryService;

    @PostMapping
    public ResponseEntity<Telemetry> receiveTelemetry(@Valid @RequestBody TelemetryRequestDTO request) {
        Telemetry saved = telemetryService.processTelemetry(request);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/route/{deviceId}")
    public ResponseEntity<List<Telemetry>> getRouteHistory(
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "12") int hours) {
        List<Telemetry> route = telemetryService.getRouteHistory(deviceId, hours);
        return ResponseEntity.ok(route);
    }

    @GetMapping("/recent/{deviceId}")
    public ResponseEntity<List<Telemetry>> getRecentTelemetry(
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "20") int limit) {
        List<Telemetry> list = telemetryService.getRecentReadings(deviceId, limit);
        return ResponseEntity.ok(list);
    }
}
