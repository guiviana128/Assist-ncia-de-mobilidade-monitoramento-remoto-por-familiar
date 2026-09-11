import React from 'react';
import { Activity, Footprints, ShieldCheck, HeartHandshake, Zap, Cpu, Wifi, Radio, BatteryCharging, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DeviceStatus } from '../types';

interface AdvancedTelemetryViewProps {
  device?: DeviceStatus;
}

export const AdvancedTelemetryView: React.FC<AdvancedTelemetryViewProps> = ({ device }) => {
  const steps = device?.stepsToday ?? 1840;
  const activeMinutes = device?.activeMinutes ?? 42;
  const mobilityScore = device?.mobilityScore ?? 86;
  const isGripHolding = device?.isGripHolding ?? true;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--accent-green-text)';
    if (score >= 50) return 'var(--accent-yellow-text)';
    return 'var(--accent-red-text)';
  };

  return (
    <div style={{ margin: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. Métricas de Saúde & Autonomia Motora */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Score de Mobilidade */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Score de Mobilidade</span>
            <HeartHandshake size={20} color={getScoreColor(mobilityScore)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, color: getScoreColor(mobilityScore) }}>
              {mobilityScore}/100
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Excelente autonomia de caminhada hoje
          </p>
        </div>

        {/* Passos e Distância */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Passos Caminhados</span>
            <Footprints size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {steps.toLocaleString('pt-BR')}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>~1.2 km</span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {activeMinutes} min de atividade física moderada
          </p>
        </div>

        {/* Sensor Grip Touch na Manopla */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sensor Grip Touch</span>
            <Zap size={20} color={isGripHolding ? 'var(--accent-green-text)' : 'var(--accent-yellow-text)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: isGripHolding ? 'var(--accent-green-text)' : 'var(--accent-yellow-text)' }}>
              {isGripHolding ? 'Empunhadura Ativa' : 'Apoiada / Em Repouso'}
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {isGripHolding ? 'Mão segurando a bengala firmemente' : 'Filtro anti-falsos positivos ativo'}
          </p>
        </div>

        {/* Monitor de Tremor e Estabilidade */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Estabilidade & Tremores</span>
            <Activity size={20} color="var(--accent-cyan)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--accent-cyan)' }}>
              Normal (1.2 Hz)
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Sem padrões anormais de tremor (3-7 Hz)
          </p>
        </div>

      </div>

      {/* 2. Gráfico Triaxial MPU-6050 + Diagnóstico de Barramentos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '16px' }}>
        
        {/* Gráfico Visual do Acelerômetro */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--accent-primary)" />
                Ondas do Acelerômetro MPU-6050 (Tempo Real)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Taxa de amostragem: 100ms • Gravidade de referência: 1.0g
              </p>
            </div>
            <span className="badge badge-online">Estável</span>
          </div>

          <div style={{ height: '170px', background: 'var(--bg-app)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 130" preserveAspectRatio="none">
              <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border-color)" strokeDasharray="3 3" />
              <line x1="0" y1="65" x2="500" y2="65" stroke="var(--border-color)" />
              <line x1="0" y1="110" x2="500" y2="110" stroke="var(--border-color)" strokeDasharray="3 3" />

              {/* Z-Axis */}
              <path d="M 0 65 Q 50 60, 100 65 T 200 63 T 300 67 T 400 64 T 500 65" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
              {/* X-Axis */}
              <path d="M 0 70 Q 40 80, 80 68 T 160 74 T 240 66 T 320 78 T 400 70 T 500 72" fill="none" stroke="#10b981" strokeWidth="2" />
              {/* Y-Axis */}
              <path d="M 0 60 Q 60 48, 120 62 T 240 56 T 360 64 T 480 58 T 500 60" fill="none" stroke="#f59e0b" strokeWidth="2" />
            </svg>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '6px', fontSize: '0.75rem' }}>
              <span style={{ color: '#10b981', fontWeight: 600 }}>● X: 0.04g (Lateral)</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Y: -0.02g (Frontal)</span>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>● Z: 0.98g (Gravidade)</span>
            </div>
          </div>
        </div>

        {/* Diagnóstico de Conexões e Sensores */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--accent-cyan)" />
            Diagnóstico de Hardware
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <span>HC-SR04 Frontal + Chão 45°</span>
              <span className="badge badge-online">2 Ativos</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <span>Farol Noturno Automático LDR</span>
              <span className="badge badge-online">Sensor OK</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <span>Duplo Motor Háptico (Dedos/Palma)</span>
              <span className="badge badge-online">Pronto</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <span>GPS NEO-6M & Satélites</span>
              <span className="badge badge-online">8 Sats (Fix 3D)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
