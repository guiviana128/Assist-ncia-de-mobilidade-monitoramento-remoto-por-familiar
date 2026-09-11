import React, { useState } from 'react';
import { Radio, Sun, Moon, Sparkles, LayoutDashboard, Activity, Settings, Share2, Check, Volume2 } from 'lucide-react';
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
      <header className="glass-panel" style={{ margin: '14px 20px 10px 20px', padding: '10px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* Nova Marca e Logotipo Exclusivo "Amparo" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)',
              width: '44px',
              height: '44px',
              borderRadius: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              position: 'relative'
            }}>
              {/* Logo SVG Customizado: Arco de Cuidado + Conexão */}
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {/* Linha de pulso e apoio */}
                <path d="M4.5 16.5c1.5 1.5 3.5 2.5 6 2.5 4.5 0 8-3.5 8-8 0-2.5-1-4.5-2.5-6" />
                <path d="M3 12h4l2-4 3 8 2-4h4" />
                <circle cx="12" cy="4" r="1.5" fill="#38bdf8" stroke="none" />
              </svg>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                  Amparo <span style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.95rem' }}>Telecuidado</span>
                </h1>
                <span className={`badge ${isOnline ? 'badge-online' : 'badge-alert'}`}>
                  <Radio size={12} className={isOnline ? 'animate-pulse' : ''} />
                  {isOnline ? 'Bengala Conectada' : 'Offline'}
                </span>
              </div>
              <p style={{ margin: '1px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Central de Proteção e Mobilidade Familiar
              </p>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-app)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              className={`nav-tab ${activeTab === 'monitor' ? 'active' : ''}`}
              onClick={() => onSelectTab('monitor')}
              style={{ height: '34px' }}
            >
              <LayoutDashboard size={15} />
              <span>Painel Geral</span>
            </button>

            <button
              className={`nav-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
              onClick={() => onSelectTab('telemetry')}
              style={{ height: '34px' }}
            >
              <Activity size={15} />
              <span>Saúde & IMU</span>
            </button>

            <button
              className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onSelectTab('settings')}
              style={{ height: '34px' }}
            >
              <Settings size={15} />
              <span>Cercas & Remédios</span>
            </button>
          </div>

          {/* Ações Rápidas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            
            {/* Botão Achar Bengala */}
            <button
              className="btn btn-secondary"
              onClick={handleFindCane}
              disabled={finding}
              style={{
                height: '38px',
                padding: '0 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '9px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Faz a bengala emitir bipes e piscar o LED para encontrá-la dentro de casa"
            >
              <Volume2 size={15} color="var(--accent-yellow-text)" />
              <span>{finding ? 'Apitando...' : 'Achar Bengala'}</span>
            </button>

            {/* Botão Compartilhar */}
            <button
              className="btn btn-secondary"
              onClick={handleShareLink}
              style={{
                height: '38px',
                padding: '0 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '9px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Copiar link de rastreamento em tempo real para enviar no WhatsApp"
            >
              {copiedLink ? <Check size={15} color="var(--accent-green-text)" /> : <Share2 size={15} />}
              <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar Live'}</span>
            </button>

            {/* Seletor Dark/Light */}
            <button
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '9px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isDarkMode ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            >
              {isDarkMode ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#3b82f6" />}
            </button>

            {/* Botão Simulador */}
            <button 
              className="btn btn-primary"
              onClick={onOpenSimulator}
              style={{
                height: '38px',
                padding: '0 16px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '9px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={15} />
              <span>Simulador</span>
            </button>
          </div>

        </div>
      </header>

      {/* Notificação Flutuante */}
      {findMsg && (
        <div style={{
          margin: '0 20px 10px 20px',
          padding: '12px 18px',
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
