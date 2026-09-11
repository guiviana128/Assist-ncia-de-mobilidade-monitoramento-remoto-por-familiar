package com.assistmob.controller;

import com.assistmob.dto.DeviceStatusDTO;
import com.assistmob.service.DeviceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DeviceController {

    private final DeviceService deviceService;

    @GetMapping
    public ResponseEntity<List<DeviceStatusDTO>> getAllDevices() {
        return ResponseEntity.ok(deviceService.getAllDevicesStatus());
    }

    @GetMapping("/{deviceId}")
    public ResponseEntity<DeviceStatusDTO> getDeviceStatus(@PathVariable String deviceId) {
        return deviceService.getDeviceStatus(deviceId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
