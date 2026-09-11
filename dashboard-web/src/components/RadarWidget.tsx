import React, { useState } from 'react';
import { Radar, Volume2, VolumeX, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RadarWidgetProps {
  distanceCm: number;
}

export const RadarWidget: React.FC<RadarWidgetProps> = ({ distanceCm }) => {
  const [soundEnabled, setSoundEnabled] = useState(false);

  const isCritical = distanceCm <= 40;
  const isWarning = distanceCm > 40 && distanceCm <= 100;
  const isSafe = distanceCm > 100;

  const getRadarColor = () => {
    if (isCritical) return '#ef4444';
    if (isWarning) return '#f59e0b';
    return '#10b981';
  };

  const getStatusText = () => {
    if (isCritical) return 'Obstáculo Crítico (< 40cm)';
    if (isWarning) return 'Obstáculo Próximo (< 1m)';
    return 'Caminho Desobstruído';
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'var(--bg-card-hover)',
            padding: '6px',
            borderRadius: '8px',
            color: 'var(--accent-primary)'
          }}>
            <Radar size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Radar Frontal HC-SR04</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sensor de Obstáculos</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            title={soundEnabled ? 'Desativar Bip Sonoro' : 'Ativar Bip Sonoro'}
          >
            {soundEnabled ? <Volume2 size={15} color="var(--accent-primary)" /> : <VolumeX size={15} />}
          </button>

          <span className={`badge ${isCritical ? 'badge-alert' : isWarning ? 'badge-warning' : 'badge-online'}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Visual Sonar SVG Display */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '190px',
        position: 'relative'
      }}>
        <svg width="240" height="135" viewBox="0 0 240 135">
          <defs>
            <radialGradient id="sonarGlow" cx="50%" cy="100%" r="100%">
              <stop offset="0%" stopColor={getRadarColor()} stopOpacity="0.3" />
              <stop offset="100%" stopColor={getRadarColor()} stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Arcos de Alcance Ultrassônico */}
          <path d="M 15 130 A 105 105 0 0 1 225 130" fill="none" stroke="var(--border-color)" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 50 130 A 70 70 0 0 1 190 130" fill="none" stroke="var(--border-color)" strokeWidth="1.5" />
          <path d="M 85 130 A 35 35 0 0 1 155 130" fill="none" stroke="var(--border-color)" strokeWidth="1.5" />

          {/* Cone de Detecção Dinâmico */}
          <path
            d="M 120 130 L 40 25 A 105 105 0 0 1 200 25 Z"
            fill="url(#sonarGlow)"
            style={{ transition: 'all 0.4s ease' }}
          />

          {/* Linhas de Ângulo (FOV de 30 graus do sensor HC-SR04) */}
          <line x1="120" y1="130" x2="60" y2="30" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="120" y1="130" x2="180" y2="30" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="120" y1="130" x2="120" y2="15" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Ponto Central do Sensor na Bengala */}
          <circle cx="120" cy="130" r="8" fill="var(--accent-primary)" />
          <circle cx="120" cy="130" r="16" fill="none" stroke="var(--accent-primary)" strokeWidth="2" opacity="0.5" />

          {/* Marcador do Objeto Detectado */}
          {distanceCm < 300 && (
            <g>
              <circle
                cx="120"
                cy={Math.max(30, 130 - (distanceCm / 300) * 100)}
                r="7"
                fill={getRadarColor()}
                style={{
                  filter: `drop-shadow(0 0 10px ${getRadarColor()})`,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
              <circle
                cx="120"
                cy={Math.max(30, 130 - (distanceCm / 300) * 100)}
                r="14"
                fill="none"
                stroke={getRadarColor()}
                strokeWidth="1.5"
                opacity="0.6"
              />
            </g>
          )}
        </svg>

        {/* Leitura Numérica e Indicadores */}
        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <div style={{
            fontSize: '1.9rem',
            fontWeight: 800,
            color: getRadarColor(),
            letterSpacing: '-0.02em'
          }}>
            {distanceCm < 500 ? `${distanceCm.toFixed(0)} cm` : '> 400 cm'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '2px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {isCritical ? <AlertTriangle size={14} color="#ef4444" /> : isWarning ? <AlertTriangle size={14} color="#f59e0b" /> : <ShieldCheck size={14} color="#10b981" />}
            <span>Feedback háptico (vibração) & buzzer ativos no ESP32</span>
          </div>
        </div>
      </div>
    </div>
  );
};
