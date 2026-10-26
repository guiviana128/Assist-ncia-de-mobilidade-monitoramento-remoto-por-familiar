import React from 'react';
import { Activity, LayoutDashboard, Settings, Sun, Moon, FlaskConical } from 'lucide-react';

interface NavbarProps {
  isOnline: boolean;
  pendingAlertsCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeTab: 'monitor' | 'live' | 'telemetry' | 'settings';
  onSelectTab: (tab: 'monitor' | 'live' | 'telemetry' | 'settings') => void;
  onOpenSimulator: () => void;
  deviceId?: string;
}
const tabs = [
  { id: 'live' as const, label: 'Câmera e SOS', icon: Activity },
  { id: 'monitor' as const, label: 'Visão geral', icon: LayoutDashboard },
  { id: 'telemetry' as const, label: 'Telemetria', icon: Activity },
  { id: 'settings' as const, label: 'Configurações', icon: Settings }
];
export const Navbar: React.FC<NavbarProps> = ({ isOnline, pendingAlertsCount, isDarkMode, onToggleTheme, activeTab, onSelectTab, onOpenSimulator }) => (
  <header className="site-header">
    <div className="brand"><div className="brand-symbol" aria-hidden="true"><Activity size={26} /></div><div><h1>Amparo<span>Telecuidado familiar</span></h1></div></div>
    <nav className="primary-nav" aria-label="Navegação principal">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-tab ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onSelectTab(id)}><Icon size={18} />{label}{id === 'monitor' && pendingAlertsCount > 0 && <span className="nav-count">{pendingAlertsCount}</span>}</button>)}
    </nav>
    <div className="header-actions"><span className={`badge ${isOnline ? 'badge-online' : 'badge-warning'}`}>{isOnline ? 'Dispositivo online' : 'Sem conexão confirmada'}</span>
      <button className="theme-toggle-btn" onClick={onToggleTheme} aria-label={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}>{isDarkMode ? <Sun size={19} /> : <Moon size={19} />}</button>
      <button className="btn btn-secondary" onClick={onOpenSimulator}><FlaskConical size={17} />Simulador</button>
    </div>
  </header>
);

