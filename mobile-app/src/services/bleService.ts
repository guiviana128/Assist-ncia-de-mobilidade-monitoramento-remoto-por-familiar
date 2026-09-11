/**
 * Serviço de Gerenciamento Bluetooth Low Energy (BLE)
 * Conecta com o ESP32 AssistMob Stick para receber telemetria direta e notificações
 */

export interface BleStickData {
  deviceId: string;
  distanceCm: number;
  latitude: number;
  longitude: number;
  batteryPercent: number;
  sosTriggered: boolean;
  fallDetected: boolean;
}

type BleCallback = (data: BleStickData) => void;

class BleManagerService {
  private isConnected: boolean = false;
  private listeners: BleCallback[] = [];

  public async scanAndConnect(): Promise<boolean> {
    console.log('[BLE] Iniciando busca pelo dispositivo AssistMob-Stick...');
    // Simulação de handshake BLE para ambiente de desenvolvimento/teste
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isConnected = true;
        console.log('[BLE] Conectado com sucesso ao ESP32 via BLE!');
        resolve(true);
      }, 1000);
    });
  }

  public disconnect(): void {
    this.isConnected = false;
    console.log('[BLE] Desconectado do ESP32.');
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public subscribe(callback: BleCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  public emitMockData(data: Partial<BleStickData>) {
    const fullData: BleStickData = {
      deviceId: 'ESP32-MOB-001',
      distanceCm: data.distanceCm ?? 115,
      latitude: data.latitude ?? -23.550520,
      longitude: data.longitude ?? -46.633308,
      batteryPercent: data.batteryPercent ?? 88,
      sosTriggered: data.sosTriggered ?? false,
      fallDetected: data.fallDetected ?? false
    };
    this.listeners.forEach(cb => cb(fullData));
  }
}

export const bleService = new BleManagerService();
