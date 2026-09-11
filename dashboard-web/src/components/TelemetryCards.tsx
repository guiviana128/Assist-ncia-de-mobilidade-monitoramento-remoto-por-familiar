import React from 'react';
import { Battery, Navigation, Eye, HeartPulse, Zap } from 'lucide-react';
import { DeviceStatus } from '../types';

interface TelemetryCardsProps {
  device?: DeviceStatus;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ device }) => {
  const battery = device?.batteryPercent ?? 100;
  const distance = device?.lastDistanceCm ?? 999;
  const obstacleAlert = device?.obstacleAlert ?? false;

  // Cor dinâmica da bateria
  const getBatteryColor = (lvl: number) => {
    if (lvl > 50) return '#10b981';
    if (lvl > 20) return '#f59e0b';
    return '#ef4444';
  };

  // Status de obstáculo
  const getObstacleStatus = (dist: number) => {
    if (dist <= 40) return { text: 'Crítico (< 40cm)', color: '#ef4444', desc: 'Risco de colisão imediata!' };
    if (dist <= 100) return { text: 'Atenção (< 1m)', color: '#f59e0b', desc: 'Obstáculo próximo' };
    return { text: 'Livre (> 1m)', color: '#10b981', desc: 'Caminho desobstruído' };
  };

  const obsInfo = getObstacleStatus(distance);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '16px',
      margin: '0 20px 20px 20px'
    }}>
      {/* Card 1: Bateria da Bengala */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Nível da Bateria (LiPo)
          </span>
          <div style={{ color: getBatteryColor(battery) }}>
            <Battery size={24} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: getBatteryColor(battery) }}>
            {battery.toFixed(0)}%
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ~{(3.2 + (battery / 100) * 1.0).toFixed(2)}V
          </span>
        </div>
        {/* Barra de Progresso */}
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
          <div style={{
            width: `${battery}%`,
            height: '100%',
            background: getBatteryColor(battery),
            transition: 'width 0.5s ease',
            borderRadius: '3px'
          }} />
        </div>
      </div>

      {/* Card 2: Sensor Ultrassônico */}
      <div className="glass-panel" style={{ padding: '20px', borderLeft: obstacleAlert ? '4px solid #ef4444' : '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Sensor Ultrassônico (HC-SR04)
          </span>
          <Eye size={24} color={obsInfo.color} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: obsInfo.color }}>
            {distance < 500 ? `${distance.toFixed(0)} cm` : '> 5m'}
          </h2>
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: obsInfo.color, fontWeight: 500 }}>
          {obsInfo.desc}
        </p>
      </div>

      {/* Card 3: Sensor de Queda e Movimento (MPU-6050) */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Acelerômetro / Queda (MPU-6050)
          </span>
          <HeartPulse size={24} color="#3b82f6" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>
            Estável / Monitorando
          </h2>
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Algoritmo anti-impacto e queda livre ativo
        </p>
      </div>

      {/* Card 4: GPS NEO-6M */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Receptor GPS (NEO-6M)
          </span>
          <Navigation size={24} color="#06b6d4" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#06b6d4' }}>
            {device?.currentLatitude?.toFixed(4)}, {device?.currentLongitude?.toFixed(4)}
          </h2>
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Sinal com Fix Ativo e Cerca Virtual 500m
        </p>
      </div>
    </div>
  );
};
