package com.assistmob.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisionEventRequestDTO {

    @NotBlank
    @Size(max = 64)
    private String eventId;

    @NotBlank
    @Size(max = 120)
    private String sessionId;

    @NotBlank
    @Size(max = 100)
    private String deviceId;

    @NotNull
    private OffsetDateTime capturedAt;

    @Valid
    @NotNull
    private Gesture gesture;

    @Valid
    @NotNull
    private Safety safety;

    @Valid
    @NotNull
    private Quality quality;

    @Valid
    @NotNull
    private Privacy privacy;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Gesture {
        @NotBlank
        @Size(max = 60)
        private String name;

        @NotBlank
        @Size(max = 60)
        private String phase;

        @DecimalMin("0.0")
        @DecimalMax("1.0")
        private double confidence;

        private boolean confirmed;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Safety {
        private boolean requiresHumanReview;
        private boolean automaticEmergencyCall;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Quality {
        private boolean usable;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Privacy {
        private boolean imageStored;
        private boolean landmarksStored;
    }
}
