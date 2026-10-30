import React from 'react';
import { Activity, Box, LayoutDashboard, LogOut, Settings, Sun, Moon, FlaskConical } from 'lucide-react';

export type AppTab = 'house' | 'monitor' | 'live' | 'telemetry' | 'settings';

interface NavbarProps {
  isOnline: boolean;
  pendingAlertsCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenSimulator: () => void;
  deviceId?: string;
  username?: string | null;
  onLogout?: () => void;
}
const tabs = [
  { id: 'house' as const, label: 'Casa 3D / AR', icon: Box },
  { id: 'live' as const, label: 'Câmera e SOS', icon: Activity },
  { id: 'monitor' as const, label: 'Visão geral', icon: LayoutDashboard },
  { id: 'telemetry' as const, label: 'Telemetria', icon: Activity },
  { id: 'settings' as const, label: 'Configurações', icon: Settings }
];
export const Navbar: React.FC<NavbarProps> = ({ isOnline, pendingAlertsCount, isDarkMode, onToggleTheme, activeTab, onSelectTab, onOpenSimulator, username, onLogout }) => (
  <header className="site-header">
    <div className="brand"><div className="brand-symbol" aria-hidden="true"><Activity size={26} /></div><div><h1>Amparo<span>Telecuidado familiar</span></h1></div></div>
    <nav className="primary-nav" aria-label="Navegação principal">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-tab ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onSelectTab(id)}><Icon size={18} />{label}{id === 'monitor' && pendingAlertsCount > 0 && <span className="nav-count">{pendingAlertsCount}</span>}</button>)}
    </nav>
    <div className="header-actions"><span className={`badge ${isOnline ? 'badge-online' : 'badge-warning'}`}>{isOnline ? 'Dispositivo online' : 'Sem conexão confirmada'}</span>
      <button className="theme-toggle-btn" onClick={onToggleTheme} aria-label={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}>{isDarkMode ? <Sun size={19} /> : <Moon size={19} />}</button>
      <button className="btn btn-secondary" onClick={onOpenSimulator}><FlaskConical size={17} />Simulador</button>
      {username && onLogout && <button className="btn btn-secondary" onClick={onLogout} title={`Sair (${username})`}><LogOut size={17} />Sair</button>}
    </div>
  </header>
);

