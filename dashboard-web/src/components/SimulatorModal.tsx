import React, { useState } from 'react';
import { X, Flame, ShieldAlert, Battery, Eye, Navigation, Send, Sparkles, CheckCircle2, Footprints, Volume2, Pill } from 'lucide-react';
import { api } from '../services/api';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({ isOpen, onClose, onRefresh }) => {
  const [obstacleDistance, setObstacleDistance] = useState(120);
  const [batteryLevel, setBatteryLevel] = useState(88);
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
    showFeedback('✅ Telemetria de sensores enviada com sucesso!');
    onRefresh();
  };

  const handleTriggerSos = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('SOS_BUTTON', '🚨 Botão SOS de Pânico acionado na bengala!');
    setLoading(false);
    showFeedback('🚨 Alerta SOS enviado com prioridade máxima!');
    onRefresh();
  };

  const handleTriggerFall = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('FALL_DETECTED', '🚨 Queda confirmada com sensor de empunhadura ativo!');
    setLoading(false);
    showFeedback('🚨 Queda registrada no sistema e cuidadores notificados!');
    onRefresh();
  };

  const handleCheckinSafe = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('CHECKIN_SAFE', '💚 Idoso efetuou Check-in "Cheguei Bem" (Duplo clique no botão)');
    setLoading(false);
    showFeedback('💚 Check-in "Cheguei Bem" recebido com sucesso!');
    onRefresh();
  };

  const handlePotholeDrop = async () => {
    setLoading(true);
    await api.sendSimulatedAlert('POTHOLE_HOLE_DETECTED', '⚠️ Desnível/buraco no piso detectado pelo sensor a 45°');
    setLoading(false);
    showFeedback('⚠️ Desnível no piso simulado!');
    onRefresh();
  };

  const handleFindCane = async () => {
    setLoading(true);
    const res = await api.findMyCane('ESP32-MOB-001');
    setLoading(false);
    showFeedback(res.message);
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
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        background: 'var(--bg-card)',
        width: '100%',
        maxWidth: '580px',
        padding: '22px',
        border: '1px solid var(--border-hover)',
        boxShadow: 'var(--shadow-float)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              Bancada de Testes ESP32 Pro
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '5px 10px', borderRadius: '8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {feedbackMsg && (
          <div style={{ padding: '10px 14px', background: 'var(--accent-primary)', color: '#ffffff', borderRadius: '8px', marginBottom: '12px', fontSize: '0.84rem', fontWeight: 600, textAlign: 'center' }}>
            {feedbackMsg}
          </div>
        )}

        {/* 1. Botões de Ações Inteligentes da Bengala */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Ações Rápidas do Hardware
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
            <button className="btn btn-secondary" onClick={handleCheckinSafe} disabled={loading} style={{ fontSize: '0.75rem', padding: '10px 6px' }}>
              💚 Duplo Clique ("Cheguei")
            </button>
            <button className="btn btn-secondary" onClick={handlePotholeDrop} disabled={loading} style={{ fontSize: '0.75rem', padding: '10px 6px' }}>
              ⚠️ Desnível Piso 45°
            </button>
            <button className="btn btn-secondary" onClick={handleFindCane} disabled={loading} style={{ fontSize: '0.75rem', padding: '10px 6px' }}>
              🔔 Localizar Bengala
            </button>
          </div>
        </div>

        {/* 2. Disparos de Emergência */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Disparos de Emergência
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
            <button className="btn btn-danger" onClick={handleTriggerSos} disabled={loading} style={{ padding: '10px' }}>
              <Flame size={16} />
              <span>Disparar Botão SOS</span>
            </button>
            <button className="btn btn-danger" onClick={handleTriggerFall} disabled={loading} style={{ padding: '10px', background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}>
              <ShieldAlert size={16} />
              <span>Simular Queda (Grip)</span>
            </button>
          </div>
        </div>

        {/* 3. Sliders de Sensores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Eye size={14} color="var(--accent-primary)" /> Obstáculo Frontal HC-SR04
              </span>
              <strong style={{ color: 'var(--accent-primary)' }}>{obstacleDistance} cm</strong>
            </div>
            <input
              type="range"
              min="10"
              max="250"
              value={obstacleDistance}
              onChange={(e) => setObstacleDistance(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Battery size={14} color="var(--accent-green-text)" /> Nível da Bateria
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

          {/* Movimentar GPS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Navigation size={14} color="var(--accent-cyan)" /> Posição GPS
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setLatitude(prev => prev + 0.001);
                  setLongitude(prev => prev + 0.001);
                }}
                style={{ fontSize: '0.76rem', padding: '6px' }}
              >
                Caminhar (+100m)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setLatitude(-23.550520);
                  setLongitude(-46.633308);
                }}
                style={{ fontSize: '0.76rem', padding: '6px' }}
              >
                Resetar p/ Casa
              </button>
            </div>
          </div>
        </div>

        {/* Botão de Envio */}
        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={handleSendTelemetry} disabled={loading} style={{ fontSize: '0.8rem' }}>
            <Send size={14} />
            <span>Enviar ao Sistema</span>
          </button>
        </div>
      </div>
    </div>
  );
};
