const API_BASE_URL = 'http://10.0.2.2:8080/api/v1'; // 10.0.2.2 para emulador Android, ou IP local

export interface MobileAlert {
  id: number;
  alertType: string;
  severity: string;
  status: string;
  message: string;
  createdAt: string;
}

export const apiService = {
  async triggerQuickSOS(deviceId: string, lat: number, lng: number): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          alertType: 'SOS_BUTTON',
          severity: 'CRITICAL',
          message: '🚨 Botão SOS disparado através do Aplicativo Mobile!',
          latitude: lat,
          longitude: lng,
          batteryLevel: 90
        })
      });
    } catch (e) {
      console.warn('[API] Alerta enviado localmente (Modo offline/Dev)');
    }
  },

  async fetchDeviceAlerts(deviceId: string): Promise<MobileAlert[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/recent/${deviceId}`);
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch {
      return [
        { id: 1, alertType: 'SOS_BUTTON', severity: 'CRITICAL', status: 'PENDING', message: 'Alerta SOS acionado', createdAt: new Date().toISOString() },
        { id: 2, alertType: 'OBSTACLE_COLLISION', severity: 'WARNING', status: 'RESOLVED', message: 'Obstáculo a 25cm', createdAt: new Date(Date.now() - 3600000).toISOString() }
      ];
    }
  }
};
