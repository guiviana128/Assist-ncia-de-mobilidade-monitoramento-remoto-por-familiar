package com.assistmob.controller;

import com.assistmob.dto.VisionEventRequestDTO;
import com.assistmob.dto.VisionEventResponseDTO;
import com.assistmob.dto.VisionEventHistoryDTO;
import com.assistmob.service.VisionEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/vision")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class VisionController {

    private final VisionEventService visionEventService;

    @PostMapping("/events")
    public ResponseEntity<VisionEventResponseDTO> receiveEvent(
            @Valid @RequestBody VisionEventRequestDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(visionEventService.receive(request));
    }

    @GetMapping("/events")
    public ResponseEntity<List<VisionEventHistoryDTO>> getRecentEvents(
            @RequestParam String deviceId) {
        return ResponseEntity.ok(visionEventService.getRecent(deviceId));
    }

    @PatchMapping("/events/{eventId}/review")
    public ResponseEntity<VisionEventHistoryDTO> reviewEvent(
            @PathVariable String eventId,
            @RequestParam String decision,
            @RequestParam(required = false) String reviewedBy) {
        return ResponseEntity.ok(visionEventService.review(eventId, decision, reviewedBy));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleInvalidEvent(IllegalArgumentException exception) {
        return ResponseEntity.unprocessableEntity().body(Map.of(
                "error", "invalid_vision_event",
                "message", exception.getMessage()
        ));
    }
}
