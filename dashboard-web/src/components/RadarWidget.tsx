import React from 'react';
import { Radar, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RadarWidgetProps {
  distanceCm: number;
}

export const RadarWidget: React.FC<RadarWidgetProps> = ({ distanceCm }) => {
  const isCritical = distanceCm <= 40;
  const isWarning = distanceCm > 40 && distanceCm <= 100;
  const isSafe = distanceCm > 100;

  const getRadarColor = () => {
    if (isCritical) return '#ef4444';
    if (isWarning) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radar size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Radar Frontal de Obstáculos</h3>
        </div>
        <span className={`badge ${isCritical ? 'badge-alert' : isWarning ? 'badge-warning' : 'badge-online'}`}>
          {isCritical ? 'Obstáculo Iminente' : isWarning ? 'Atenção' : 'Via Livre'}
        </span>
      </div>

      {/* Visualizador Gráfico de Radar Sonar */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        position: 'relative'
      }}>
        <svg width="220" height="130" viewBox="0 0 220 130">
          {/* Arcos de Distância */}
          <path d="M 10 120 A 100 100 0 0 1 210 120" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M 45 120 A 65 65 0 0 1 175 120" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          <path d="M 75 120 A 35 35 0 0 1 145 120" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

          {/* Cone de Detecção Dinâmico */}
          <path
            d="M 110 120 L 50 20 A 100 100 0 0 1 170 20 Z"
            fill={getRadarColor()}
            fillOpacity={isCritical ? "0.35" : isWarning ? "0.2" : "0.08"}
            style={{ transition: 'all 0.4s ease' }}
          />

          {/* Ponto Central do Sensor */}
          <circle cx="110" cy="120" r="8" fill="#3b82f6" />
          <circle cx="110" cy="120" r="14" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />

          {/* Indicador de Objeto Detectado */}
          {distanceCm < 300 && (
            <circle
              cx="110"
              cy={Math.max(25, 120 - (distanceCm / 300) * 95)}
              r="6"
              fill={getRadarColor()}
              style={{
                filter: `drop-shadow(0 0 8px ${getRadarColor()})`,
                transition: 'all 0.3s ease'
              }}
            />
          )}
        </svg>

        {/* Leitura Numérica no Centro */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: getRadarColor() }}>
            {distanceCm < 500 ? `${distanceCm.toFixed(0)} cm` : '> 500 cm'}
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Alcance do Sensor HC-SR04: 2cm a 400cm
          </p>
        </div>
      </div>
    </div>
  );
};
