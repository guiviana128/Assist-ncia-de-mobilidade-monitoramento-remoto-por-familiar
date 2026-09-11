package com.assistmob.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceStatusDTO {
    private String deviceId;
    private String name;
    private boolean isOnline;
    private Double currentLatitude;
    private Double currentLongitude;
    private Float batteryPercent;
    private Float lastDistanceCm;
    private Boolean obstacleAlert;
    private LocalDateTime lastUpdate;
}
