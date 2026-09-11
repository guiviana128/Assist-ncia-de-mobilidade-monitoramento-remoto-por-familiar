import React, { useState } from 'react';
import { X, Flame, ShieldAlert, Battery, Eye, Navigation, Send } from 'lucide-react';
import { api } from '../services/api';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({ isOpen, onClose, onRefresh }) => {
  const [obstacleDistance, setObstacleDistance] = useState(120);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [latitude, setLatitude] = useState(-23.550520);
  const [longitude, setLongitude] = useState(-46.633308);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendTelemetry = async () => {
    setLoading(true);
    await api.sendSimulatedTelemetry({
      obstacleDistanceCm: obstacleDistance,
      obstacleDetected: obstacleDistance < 100,
      batteryPercent: batteryLevel,
      latitude,
      longitude,
      speedKmh: 3.2
    });
    setLoading(false);
    onRefresh();
  };

  const handleTriggerSos = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('SOS_BUTTON', '🚨 Botão de Pânico SOS acionado manualmente pelo usuário!');
    setLoading(false);
    onRefresh();
  };

  const handleTriggerFall = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('FALL_DETECTED', '🚨 Queda brusca detectada pelo sensor de aceleração MPU-6050!');
    setLoading(false);
    onRefresh();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        background: 'var(--bg-secondary)',
        width: '100%',
        maxWidth: '540px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.15)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Simulador de Dispositivo ESP32
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Envie comandos e telemetria para testar o sistema em tempo real
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Botões de Emergência Imediata */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Disparadores de Emergência
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
            <button
              className="btn btn-danger"
              onClick={handleTriggerSos}
              disabled={loading}
              style={{ padding: '14px' }}
            >
              <Flame size={20} />
              <span>Disparar Botão SOS</span>
            </button>

            <button
              className="btn btn-danger"
              onClick={handleTriggerFall}
              disabled={loading}
              style={{ padding: '14px', background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
            >
              <ShieldAlert size={20} />
              <span>Simular Queda (MPU)</span>
            </button>
          </div>
        </div>

        {/* Sliders de Sensores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Ultrassom */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={16} color="#3b82f6" /> Sensor Ultrassônico (HC-SR04)
              </span>
              <strong>{obstacleDistance} cm</strong>
            </div>
            <input
              type="range"
              min="10"
              max="250"
              value={obstacleDistance}
              onChange={(e) => setObstacleDistance(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          {/* Bateria */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Battery size={16} color="#10b981" /> Nível da Bateria
              </span>
              <strong>{batteryLevel}%</strong>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={batteryLevel}
              onChange={(e) => setBatteryLevel(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#10b981' }}
            />
          </div>

          {/* Deslocamento GPS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Navigation size={16} color="#06b6d4" /> Posição GPS
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setLatitude(prev => prev + 0.001);
                  setLongitude(prev => prev + 0.001);
                }}
                style={{ fontSize: '0.8rem' }}
              >
                Caminhar (+ Norte/Leste)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setLatitude(-23.550520);
                  setLongitude(-46.633308);
                }}
                style={{ fontSize: '0.8rem' }}
              >
                Resetar para Casa
              </button>
            </div>
          </div>
        </div>

        {/* Ação de Envio */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={handleSendTelemetry} disabled={loading}>
            <Send size={16} />
            <span>Enviar Leitura ao Sistema</span>
          </button>
        </div>
      </div>
    </div>
  );
};
