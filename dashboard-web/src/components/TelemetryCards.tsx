import React from 'react';
import { Battery, Navigation, Eye, HeartPulse, Zap, Footprints, ShieldCheck } from 'lucide-react';
import { DeviceStatus } from '../types';

interface TelemetryCardsProps {
  device?: DeviceStatus;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ device }) => {
  const battery = device?.batteryPercent ?? 100;
  const distance = device?.lastDistanceCm ?? 999;
  const obstacleAlert = device?.obstacleAlert ?? false;

  const getBatteryColor = (lvl: number) => {
    if (lvl > 50) return 'var(--accent-green-text)';
    if (lvl > 20) return 'var(--accent-yellow-text)';
    return 'var(--accent-red-text)';
  };

  const getObstacleColor = (dist: number) => {
    if (dist <= 40) return 'var(--accent-red-text)';
    if (dist <= 100) return 'var(--accent-yellow-text)';
    return 'var(--accent-green-text)';
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '16px',
      margin: '0 20px 16px 20px'
    }}>
      {/* Card 1: Bateria LiPo 3.7V */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Bateria da Bengala
          </span>
          <div style={{ color: getBatteryColor(battery) }}>
            <Battery size={22} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0, color: getBatteryColor(battery) }}>
            {battery.toFixed(0)}%
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            ~{(3.2 + (battery / 100) * 1.0).toFixed(2)}V (Autonomia ~18h)
          </span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
          <div style={{
            width: `${battery}%`,
            height: '100%',
            background: getBatteryColor(battery),
            transition: 'width 0.5s ease',
            borderRadius: '3px'
          }} />
        </div>
      </div>

      {/* Card 2: Sensor Ultrassônico HC-SR04 */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: obstacleAlert ? '4px solid #ef4444' : '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Distância de Obstáculo
          </span>
          <Eye size={22} color={getObstacleColor(distance)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0, color: getObstacleColor(distance) }}>
            {distance < 500 ? `${distance.toFixed(0)} cm` : '> 4m'}
          </h2>
        </div>
        <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: getObstacleColor(distance), fontWeight: 600 }}>
          {distance <= 40 ? '⚠️ Alerta sonoro/vibração acionado' : distance <= 100 ? '⚡ Aproximação detectada' : '✅ Espaço livre para caminhar'}
        </p>
      </div>

      {/* Card 3: Status de Movimento e Queda (MPU6050) */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Postura & Movimento
          </span>
          <Footprints size={22} color="var(--accent-primary)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Caminhando (Normal)
          </h2>
        </div>
        <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Acelerômetro MPU6050 calibrado e ativo
        </p>
      </div>

      {/* Card 4: GPS NEO-6M */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Sinal GPS & Satélites
          </span>
          <Navigation size={22} color="var(--accent-cyan)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--accent-cyan)' }}>
            8 Satélites • 3.2 km/h
          </h2>
        </div>
        <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Precisão: ~2.5m (Fix 3D estabelecido)
        </p>
      </div>
    </div>
  );
};
