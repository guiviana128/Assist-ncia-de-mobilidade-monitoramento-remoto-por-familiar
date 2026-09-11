import React, { useState } from 'react';
import { Shield, Radio, Sun, Moon, Sparkles, Bell, LayoutDashboard, Activity, Settings, Search, Share2, Check, Volume2 } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  isOnline: boolean;
  pendingAlertsCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeTab: 'monitor' | 'telemetry' | 'settings';
  onSelectTab: (tab: 'monitor' | 'telemetry' | 'settings') => void;
  onOpenSimulator: () => void;
  deviceId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  pendingAlertsCount,
  isDarkMode,
  onToggleTheme,
  activeTab,
  onSelectTab,
  onOpenSimulator,
  deviceId = 'ESP32-MOB-001'
}) => {
  const [finding, setFinding] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [findMsg, setFindMsg] = useState<string | null>(null);

  const handleFindCane = async () => {
    setFinding(true);
    const res = await api.findMyCane(deviceId);
    setFindMsg(res.message);
    setTimeout(() => {
      setFinding(false);
      setFindMsg(null);
    }, 4000);
  };

  const handleShareLink = () => {
    const shareUrl = `${window.location.origin}/live/track-${deviceId.toLowerCase()}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <>
      <header className="glass-panel" style={{ margin: '14px 20px 10px 20px', padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          
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
                  AssistMob <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Pro Guardian</span>
                </h1>
                <span className={`badge ${isOnline ? 'badge-online' : 'badge-alert'}`}>
                  <Radio size={12} className={isOnline ? 'animate-pulse' : ''} />
                  {isOnline ? 'ESP32 Online' : 'Offline'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Assistência de Mobilidade & Monitoramento Médico Familiar
              </p>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-app)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              className={`nav-tab ${activeTab === 'monitor' ? 'active' : ''}`}
              onClick={() => onSelectTab('monitor')}
            >
              <LayoutDashboard size={15} />
              <span>Painel Geral</span>
            </button>

            <button
              className={`nav-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
              onClick={() => onSelectTab('telemetry')}
            >
              <Activity size={15} />
              <span>Saúde & IMU</span>
            </button>

            <button
              className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onSelectTab('settings')}
            >
              <Settings size={15} />
              <span>Cercas & Remédios</span>
            </button>
          </div>

          {/* Ações Rápidas: Localizador, Compartilhar e Dark Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            
            {/* Botão Achar Bengala */}
            <button
              className="btn btn-secondary"
              onClick={handleFindCane}
              disabled={finding}
              style={{ fontSize: '0.78rem', padding: '7px 12px' }}
              title="Faz a bengala apitar e piscar o LED para encontrá-la dentro de casa"
            >
              <Volume2 size={15} color="var(--accent-yellow-text)" />
              <span>{finding ? 'Apitando...' : 'Achar Bengala'}</span>
            </button>

            {/* Botão Compartilhar com SAMU/Família */}
            <button
              className="btn btn-secondary"
              onClick={handleShareLink}
              style={{ fontSize: '0.78rem', padding: '7px 12px' }}
              title="Copiar link de rastreamento em tempo real para enviar no WhatsApp"
            >
              {copiedLink ? <Check size={15} color="var(--accent-green-text)" /> : <Share2 size={15} />}
              <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar Live'}</span>
            </button>

            {/* Seletor Dark/Light */}
            <button
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              style={{ padding: '7px 12px' }}
            >
              {isDarkMode ? <Sun size={15} color="#fbbf24" /> : <Moon size={15} color="#3b82f6" />}
            </button>

            {/* Botão Simulador */}
            <button 
              className="btn btn-primary"
              onClick={onOpenSimulator}
              style={{ fontSize: '0.78rem', padding: '7px 14px' }}
            >
              <Sparkles size={15} />
              <span>Simulador</span>
            </button>
          </div>

        </div>
      </header>

      {/* Notificação Flutuante de Localização da Bengala */}
      {findMsg && (
        <div style={{
          margin: '0 20px 10px 20px',
          padding: '10px 16px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          borderRadius: '10px',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <Volume2 size={18} />
          <span>{findMsg}</span>
        </div>
      )}
    </>
  );
};
