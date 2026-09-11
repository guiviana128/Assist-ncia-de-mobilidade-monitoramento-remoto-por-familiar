import React from 'react';
import { Activity, Cpu, Wifi, Radio, BatteryCharging, Gauge, CheckCircle2 } from 'lucide-react';
import { DeviceStatus } from '../types';

interface AdvancedTelemetryViewProps {
  device?: DeviceStatus;
}

export const AdvancedTelemetryView: React.FC<AdvancedTelemetryViewProps> = ({ device }) => {
  return (
    <div style={{ margin: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Banner de Diagnóstico do ESP32 */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--accent-primary)', padding: '10px', borderRadius: '12px', color: '#ffffff' }}>
              <Cpu size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Diagnóstico de Hardware ESP32 & Sensores
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                ID: {device?.deviceId || 'ESP32-MOB-001'} • Firmware: v1.0.0 • Free Heap: 184 KB
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge badge-online">
              <Wifi size={13} /> Wi-Fi RSSI: -58 dBm
            </span>
            <span className="badge badge-online">
              <Radio size={13} /> BLE Conectável
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Gráfico de Aceleração IMU + Status de Barramentos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '20px' }}>
        
        {/* Gráfico Visual do Acelerômetro MPU6050 (X, Y, Z) */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--accent-primary)" />
                Leituras do Acelerômetro Triaxial (MPU-6050)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Monitoramento contínuo de aceleração vetorial em 'g' (1g ≈ 9.81 m/s²)
              </p>
            </div>
            <span className="badge badge-online">Frequência: 10 Hz</span>
          </div>

          {/* Gráfico SVG Simulado em Tempo Real */}
          <div style={{ height: '180px', position: 'relative', background: 'var(--bg-app)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 140" preserveAspectRatio="none">
              {/* Linhas de Grade */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border-color)" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="var(--border-color)" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border-color)" strokeDasharray="3 3" />

              {/* Onda Eixo Z (Gravidade ~ 1.0g) */}
              <path
                d="M 0 70 Q 50 65, 100 70 T 200 68 T 300 72 T 400 69 T 500 70"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
              />

              {/* Onda Eixo X */}
              <path
                d="M 0 75 Q 40 85, 80 72 T 160 80 T 240 70 T 320 82 T 400 75 T 500 76"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />

              {/* Onda Eixo Y */}
              <path
                d="M 0 65 Q 60 50, 120 68 T 240 60 T 360 70 T 480 62 T 500 65"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
              />
            </svg>

            {/* Legenda dos Eixos */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '8px', fontSize: '0.78rem' }}>
              <span style={{ color: '#10b981', fontWeight: 600 }}>● Eixo X: 0.04g</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Eixo Y: -0.02g</span>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>● Eixo Z (Gravidade): 0.98g</span>
            </div>
          </div>
        </div>

        {/* Tabela de Status dos Periféricos de Hardware */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gauge size={18} color="var(--accent-cyan)" />
            Status dos Periféricos
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>HC-SR04 (Ultrassom)</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>GPIO 5 (TRIG) / GPIO 18 (ECHO)</p>
              </div>
              <span className="badge badge-online">OK (100ms)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>MPU-6050 (Acelerômetro)</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>I2C (SDA:21, SCL:22)</p>
              </div>
              <span className="badge badge-online">Calibrado</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>NEO-6M (Módulo GPS)</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>UART 2 (RX:16, TX:17)</p>
              </div>
              <span className="badge badge-online">Fix 3D (8 Sats)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>Botão de Pânico SOS</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>GPIO 4 (Pull-Up Interrupt)</p>
              </div>
              <span className="badge badge-online">Pronto</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
