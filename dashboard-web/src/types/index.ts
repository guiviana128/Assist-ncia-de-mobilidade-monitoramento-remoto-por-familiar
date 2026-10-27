export type AlertType = 
  | 'SOS_BUTTON'
  | 'FALL_DETECTED'
  | 'OBSTACLE_COLLISION'
  | 'POTHOLE_HOLE_DETECTED'
  | 'LOW_BATTERY'
  | 'GEOFENCE_EXIT'
  | 'DEVICE_OFFLINE'
  | 'CHECKIN_SAFE'
  | 'TREMOR_DETECTED'
  | 'FATIGUE_WARNING'
  | 'MEDICATION_REMINDER'
  | 'SUSPICIOUS_PERSON_DETECTED'
  | 'SUSPICIOUS_PROXIMITY_ALERT'
  | 'THREAT_STALKING_WARNING'
  | 'HAND_GESTURE_SOS'\n  | 'AGENT_RECOMMENDATION';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alert {
  id: number;
  deviceId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  latitude: number;
  longitude: number;
  batteryLevel?: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface DeviceStatus {
  deviceId: string;
  name: string;
  isOnline: boolean;
  currentLatitude: number;
  currentLongitude: number;
  batteryPercent: number;
  lastDistanceCm?: number;
  obstacleAlert?: boolean;
  lastUpdate?: string;
  isGripHolding?: boolean;
  stepsToday?: number;
  activeMinutes?: number;
  mobilityScore?: number;
}

export interface TelemetryPoint {
  id?: number;
  deviceId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  satellites?: number;
  obstacleDistanceCm?: number;
  obstacleDetected?: boolean;
  batteryPercent?: number;
  fallDetected?: boolean;
  recordedAt?: string;
}

export interface DashboardSummary {
  totalDevices: number;
  onlineDevices: number;
  pendingAlertsCount: number;
  recentAlerts: Alert[];
  devices: DeviceStatus[];
}

