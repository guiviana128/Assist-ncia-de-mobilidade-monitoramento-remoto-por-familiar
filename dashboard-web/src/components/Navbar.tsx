import React from 'react';
import { Shield, Radio, Activity, Sparkles, Bell } from 'lucide-react';

interface NavbarProps {
  isOnline: boolean;
  pendingAlertsCount: number;
  onOpenSimulator: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isOnline, pendingAlertsCount, onOpenSimulator }) => {
  return (
    <header className="glass-panel" style={{ margin: '16px 20px', padding: '14px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Marca e Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
          }}>
            <Shield size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                AssistMob <span style={{ color: '#3b82f6', fontWeight: 400 }}>| Monitor</span>
              </h1>
              <span className={`badge ${isOnline ? 'badge-online' : 'badge-alert'}`}>
                <Radio size={12} className={isOnline ? 'animate-pulse' : ''} />
                {isOnline ? 'ESP32 Online' : 'Desconectado'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Painel de Proteção e Mobilidade do Familiar
            </p>
          </div>
        </div>

        {/* Ações e Alertas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {pendingAlertsCount > 0 && (
            <div className="badge badge-alert" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
              <Bell size={16} />
              {pendingAlertsCount} {pendingAlertsCount === 1 ? 'Alerta Pendente' : 'Alertas Pendentes'}
            </div>
          )}

          <button 
            className="btn btn-primary"
            onClick={onOpenSimulator}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Sparkles size={16} />
            <span>Simulador de Sensores / SOS</span>
          </button>
        </div>

      </div>
    </header>
  );
};
