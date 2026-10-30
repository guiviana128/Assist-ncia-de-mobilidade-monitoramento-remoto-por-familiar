package com.assistmob.controller;

import com.assistmob.dto.VisionEventRequestDTO;
import com.assistmob.dto.VisionEventResponseDTO;
import com.assistmob.service.VisionEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/vision")
@RequiredArgsConstructor
public class VisionController {

    private final VisionEventService visionEventService;

    @PostMapping("/events")
    public ResponseEntity<VisionEventResponseDTO> receiveEvent(
            @Valid @RequestBody VisionEventRequestDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(visionEventService.receive(request));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleInvalidEvent(IllegalArgumentException exception) {
        return ResponseEntity.unprocessableEntity().body(Map.of(
                "error", "invalid_vision_event",
                "message", exception.getMessage()
        ));
    }
}
