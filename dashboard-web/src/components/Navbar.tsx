import React from 'react';
import { Shield, Radio, Sun, Moon, Sparkles, Bell, LayoutDashboard, Activity, Settings } from 'lucide-react';

interface NavbarProps {
  isOnline: boolean;
  pendingAlertsCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeTab: 'monitor' | 'telemetry' | 'settings';
  onSelectTab: (tab: 'monitor' | 'telemetry' | 'settings') => void;
  onOpenSimulator: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  pendingAlertsCount,
  isDarkMode,
  onToggleTheme,
  activeTab,
  onSelectTab,
  onOpenSimulator
}) => {
  return (
    <header className="glass-panel" style={{ margin: '16px 20px 12px 20px', padding: '12px 20px' }}>
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
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                AssistMob <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>| Guardian</span>
              </h1>
              <span className={`badge ${isOnline ? 'badge-online' : 'badge-alert'}`}>
                <Radio size={12} className={isOnline ? 'animate-pulse' : ''} />
                {isOnline ? 'ESP32 Conectado' : 'Offline'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Monitoramento Remoto & Assistência de Mobilidade
            </p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-app)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button
            className={`nav-tab ${activeTab === 'monitor' ? 'active' : ''}`}
            onClick={() => onSelectTab('monitor')}
          >
            <LayoutDashboard size={16} />
            <span>Painel Geral</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => onSelectTab('telemetry')}
          >
            <Activity size={16} />
            <span>Telemetria & IMU</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => onSelectTab('settings')}
          >
            <Settings size={16} />
            <span>Cerca & Contatos</span>
          </button>
        </div>

        {/* Ações, Alertas e Dark Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {pendingAlertsCount > 0 && (
            <div className="badge badge-alert" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
              <Bell size={15} />
              {pendingAlertsCount} {pendingAlertsCount === 1 ? 'Alerta Pendente' : 'Alertas'}
            </div>
          )}

          {/* Botão Seletor de Modo Dark / Light */}
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={isDarkMode ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          >
            {isDarkMode ? (
              <>
                <Sun size={17} color="#fbbf24" />
                <span style={{ fontSize: '0.8rem' }}>Modo Claro</span>
              </>
            ) : (
              <>
                <Moon size={17} color="#3b82f6" />
                <span style={{ fontSize: '0.8rem' }}>Modo Escuro</span>
              </>
            )}
          </button>

          <button 
            className="btn btn-primary"
            onClick={onOpenSimulator}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={16} />
            <span>Simulador ESP32</span>
          </button>
        </div>

      </div>
    </header>
  );
};
