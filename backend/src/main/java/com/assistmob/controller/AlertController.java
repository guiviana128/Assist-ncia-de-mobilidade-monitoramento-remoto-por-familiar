package com.assistmob.controller;

import com.assistmob.dto.AlertRequestDTO;
import com.assistmob.dto.AlertResponseDTO;
import com.assistmob.service.AlertService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AlertController {

    private final AlertService alertService;

    @PostMapping
    public ResponseEntity<AlertResponseDTO> createAlert(@Valid @RequestBody AlertRequestDTO request) {
        AlertResponseDTO response = alertService.createAlert(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/recent/{deviceId}")
    public ResponseEntity<List<AlertResponseDTO>> getRecentAlerts(
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(alertService.getRecentAlerts(deviceId, limit));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<AlertResponseDTO>> getPendingAlerts() {
        return ResponseEntity.ok(alertService.getPendingAlerts());
    }

    @PatchMapping("/{alertId}/resolve")
    public ResponseEntity<AlertResponseDTO> resolveAlert(
            @PathVariable Long alertId,
            @RequestParam(required = false, defaultValue = "Familiar") String resolvedBy) {
        return ResponseEntity.ok(alertService.resolveAlert(alertId, resolvedBy));
    }
}
