import { Alert, DashboardSummary, DeviceStatus, TelemetryPoint } from '../types';

const API_BASE_URL = 'http://localhost:8080/api/v1';

let mockDevice: DeviceStatus = {
  deviceId: 'ESP32-MOB-001',
  name: 'Bengala Inteligente AssistMob Pro (José)',
  isOnline: true,
  currentLatitude: -23.550520,
  currentLongitude: -46.633308,
  batteryPercent: 88,
  lastDistanceCm: 145,
  obstacleAlert: false,
  lastUpdate: new Date().toISOString(),
  isGripHolding: true,
  stepsToday: 1840,
  activeMinutes: 42,
  mobilityScore: 86
};

let mockAlerts: Alert[] = [
  {
    id: 1,
    deviceId: 'ESP32-MOB-001',
    alertType: 'CHECKIN_SAFE',
    severity: 'INFO',
    status: 'RESOLVED',
    message: 'Check-in Seguro efetuado pelo idoso: "Cheguei bem na praça"',
    latitude: -23.550520,
    longitude: -46.633308,
    batteryLevel: 88,
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  },
  {
    id: 2,
    deviceId: 'ESP32-MOB-001',
    alertType: 'POTHOLE_HOLE_DETECTED',
    severity: 'WARNING',
    status: 'RESOLVED',
    message: 'Desnível / degrau de 35cm detectado pelo sensor no piso',
    latitude: -23.551200,
    longitude: -46.634100,
    batteryLevel: 90,
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  }
];

export const api = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/summary`);
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch {
      return {
        totalDevices: 1,
        onlineDevices: mockDevice.isOnline ? 1 : 0,
        pendingAlertsCount: mockAlerts.filter(a => a.status === 'PENDING').length,
        recentAlerts: mockAlerts,
        devices: [mockDevice]
      };
    }
  },

  async getRecentRoute(deviceId: string): Promise<TelemetryPoint[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/route/${deviceId}?hours=12`);
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch {
      return [
        { deviceId, latitude: -23.5520, longitude: -46.6350, speedKmh: 3.2, batteryPercent: 92, recordedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString() },
        { deviceId, latitude: -23.5515, longitude: -46.6342, speedKmh: 2.8, batteryPercent: 90, recordedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
        { deviceId, latitude: -23.5508, longitude: -46.6338, speedKmh: 3.0, batteryPercent: 89, recordedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
        { deviceId, latitude: mockDevice.currentLatitude, longitude: mockDevice.currentLongitude, speedKmh: 0.0, batteryPercent: mockDevice.batteryPercent, recordedAt: new Date().toISOString() }
      ];
    }
  },

  async resolveAlert(alertId: number, resolvedBy: string = 'Familiar'): Promise<Alert> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve?resolvedBy=${encodeURIComponent(resolvedBy)}`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch {
      const alert = mockAlerts.find(a => a.id === alertId);
      if (alert) {
        alert.status = 'RESOLVED';
        alert.resolvedAt = new Date().toISOString();
      }
      return alert!;
    }
  },

  async findMyCane(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${deviceId}/find`, { method: 'POST' });
      if (!res.ok) throw new Error('API Error');
      return { success: true, message: 'Comando de localização sonoro e luminoso emitido para a bengala!' };
    } catch {
      return { success: true, message: '🔔 Bengala Localizada! Alarme sonoro e farol LED ativados por 10s.' };
    }
  },

  async scheduleMedicineReminder(deviceId: string, medicineName: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/devices/${deviceId}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicineName })
      });
    } catch {
      const newAlert: Alert = {
        id: Date.now(),
        deviceId,
        alertType: 'MEDICATION_REMINDER',
        severity: 'INFO',
        status: 'PENDING',
        message: `⏰ Lembrete de Medicamento: ${medicineName}`,
        latitude: mockDevice.currentLatitude,
        longitude: mockDevice.currentLongitude,
        createdAt: new Date().toISOString()
      };
      mockAlerts = [newAlert, ...mockAlerts];
    }
  },

  async sendSimulatedTelemetry(data: Partial<TelemetryPoint>): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: mockDevice.deviceId,
          latitude: data.latitude ?? mockDevice.currentLatitude,
          longitude: data.longitude ?? mockDevice.currentLongitude,
          speedKmh: data.speedKmh ?? 3.5,
          satellites: 8,
          obstacleDistanceCm: data.obstacleDistanceCm ?? 120,
          obstacleDetected: data.obstacleDetected ?? false,
          batteryPercent: data.batteryPercent ?? mockDevice.batteryPercent,
          fallDetected: data.fallDetected ?? false
        })
      });
    } catch {
      mockDevice = {
        ...mockDevice,
        currentLatitude: data.latitude ?? mockDevice.currentLatitude,
        currentLongitude: data.longitude ?? mockDevice.currentLongitude,
        batteryPercent: data.batteryPercent ?? mockDevice.batteryPercent,
        lastDistanceCm: data.obstacleDistanceCm ?? mockDevice.lastDistanceCm,
        obstacleAlert: data.obstacleDetected ?? mockDevice.obstacleAlert,
        lastUpdate: new Date().toISOString()
      };
    }
  },

  async sendSimulatedAlert(alertType: Alert['alertType'], message: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: mockDevice.deviceId,
          alertType,
          severity: alertType === 'SOS_BUTTON' || alertType === 'FALL_DETECTED' ? 'CRITICAL' : alertType === 'CHECKIN_SAFE' || alertType === 'MEDICATION_REMINDER' ? 'INFO' : 'WARNING',
          message,
          latitude: mockDevice.currentLatitude,
          longitude: mockDevice.currentLongitude,
          batteryLevel: mockDevice.batteryPercent
        })
      });
    } catch {
      const newAlert: Alert = {
        id: Date.now(),
        deviceId: mockDevice.deviceId,
        alertType,
        severity: alertType === 'SOS_BUTTON' || alertType === 'FALL_DETECTED' ? 'CRITICAL' : alertType === 'CHECKIN_SAFE' || alertType === 'MEDICATION_REMINDER' ? 'INFO' : 'WARNING',
        status: alertType === 'CHECKIN_SAFE' ? 'RESOLVED' : 'PENDING',
        message,
        latitude: mockDevice.currentLatitude,
        longitude: mockDevice.currentLongitude,
        batteryLevel: mockDevice.batteryPercent,
        createdAt: new Date().toISOString(),
        resolvedAt: alertType === 'CHECKIN_SAFE' ? new Date().toISOString() : undefined
      };
      mockAlerts = [newAlert, ...mockAlerts];
    }
  }
};
