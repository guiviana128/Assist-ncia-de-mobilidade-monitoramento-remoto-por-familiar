import React, { useState } from 'react';
import { X, Flame, ShieldAlert, Battery, Eye, Navigation, Send, Sparkles, AlertCircle } from 'lucide-react';
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
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

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
    showFeedback('✅ Telemetria enviada com sucesso ao servidor!');
    onRefresh();
  };

  const handleTriggerSos = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('SOS_BUTTON', '🚨 Botão de Pânico SOS acionado manualmente pelo idoso na bengala!');
    setLoading(false);
    showFeedback('🚨 Alerta SOS emitido com prioridade máxima!');
    onRefresh();
  };

  const handleTriggerFall = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('FALL_DETECTED', '🚨 Queda brusca detectada pelo sensor de aceleração MPU-6050!');
    setLoading(false);
    showFeedback('🚨 Queda registrada no sistema e cuidadores notificados!');
    onRefresh();
  };

  // Cenários Pré-definidos
  const applyPreset = async (type: 'fall' | 'obstacle' | 'geofence' | 'lowbat') => {
    setLoading(true);
    if (type === 'fall') {
      await api.sendSimulatedAlert('FALL_DETECTED', 'Queda livre seguida de impacto detectada no sensor MPU6050');
      showFeedback('⚡ Cenário de Queda ativado!');
    } else if (type === 'obstacle') {
      setObstacleDistance(25);
      await api.sendSimulatedTelemetry({ obstacleDistanceCm: 25, obstacleDetected: true });
      await api.sendSimulatedAlert('OBSTACLE_COLLISION', 'Obstáculo iminente a menos de 30cm');
      showFeedback('⚡ Cenário de Obstáculo Próximo ativado!');
    } else if (type === 'geofence') {
      setLatitude(-23.5650);
      setLongitude(-46.6450);
      await api.sendSimulatedTelemetry({ latitude: -23.5650, longitude: -46.6450 });
      await api.sendSimulatedAlert('GEOFENCE_EXIT', 'Usuário ultrapassou o raio de 500m da área segura');
      showFeedback('⚡ Cenário de Saída da Cerca Virtual ativado!');
    } else if (type === 'lowbat') {
      setBatteryLevel(12);
      await api.sendSimulatedTelemetry({ batteryPercent: 12 });
      await api.sendSimulatedAlert('LOW_BATTERY', 'Bateria da bengala em 12% - Recarga necessária');
      showFeedback('⚡ Cenário de Bateria Fraca ativado!');
    }
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
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        background: 'var(--bg-card)',
        width: '100%',
        maxWidth: '560px',
        padding: '24px',
        border: '1px solid var(--border-hover)',
        boxShadow: 'var(--shadow-float)'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
              Bancada de Simulação ESP32
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '8px', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {feedbackMsg && (
          <div style={{ padding: '10px 14px', background: 'var(--accent-primary)', color: '#ffffff', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', animation: 'fadeIn 0.2s' }}>
            {feedbackMsg}
          </div>
        )}

        {/* Cenários de Teste Rápido */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Cenários Rápidos de Teste
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
            <button className="btn btn-secondary" onClick={() => applyPreset('fall')} disabled={loading} style={{ fontSize: '0.78rem' }}>
              💥 Queda no Chão
            </button>
            <button className="btn btn-secondary" onClick={() => applyPreset('obstacle')} disabled={loading} style={{ fontSize: '0.78rem' }}>
              🚧 Obstáculo a 25cm
            </button>
            <button className="btn btn-secondary" onClick={() => applyPreset('geofence')} disabled={loading} style={{ fontSize: '0.78rem' }}>
              📍 Sair da Cerca (GPS)
            </button>
            <button className="btn btn-secondary" onClick={() => applyPreset('lowbat')} disabled={loading} style={{ fontSize: '0.78rem' }}>
              🪫 Bateria 12%
            </button>
          </div>
        </div>

        {/* Botões de Emergência Direta */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Disparo Direto de Emergência
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
            <button className="btn btn-danger" onClick={handleTriggerSos} disabled={loading} style={{ padding: '12px' }}>
              <Flame size={18} />
              <span>Disparar Botão SOS</span>
            </button>
            <button className="btn btn-danger" onClick={handleTriggerFall} disabled={loading} style={{ padding: '12px', background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}>
              <ShieldAlert size={18} />
              <span>G-Force Impact (MPU)</span>
            </button>
          </div>
        </div>

        {/* Sliders Manuais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Eye size={15} color="var(--accent-primary)" /> Sensor Ultrassônico (HC-SR04)
              </span>
              <strong style={{ color: 'var(--accent-primary)' }}>{obstacleDistance} cm</strong>
            </div>
            <input
              type="range"
              min="10"
              max="300"
              value={obstacleDistance}
              onChange={(e) => setObstacleDistance(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Battery size={15} color="var(--accent-green-text)" /> Bateria do ESP32
              </span>
              <strong style={{ color: 'var(--accent-green-text)' }}>{batteryLevel}%</strong>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={batteryLevel}
              onChange={(e) => setBatteryLevel(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-green-text)' }}
            />
          </div>
        </div>

        {/* Botão de Envio de Telemetria Customizada */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={handleSendTelemetry} disabled={loading}>
            <Send size={15} />
            <span>Enviar ao Sistema</span>
          </button>
        </div>
      </div>
    </div>
  );
};
