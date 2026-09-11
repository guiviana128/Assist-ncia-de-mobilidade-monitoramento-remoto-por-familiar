package com.assistmob.dto;

import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardSummaryDTO {
    private long totalDevices;
    private long onlineDevices;
    private long pendingAlertsCount;
    private List<AlertResponseDTO> recentAlerts;
    private List<DeviceStatusDTO> devices;
}
