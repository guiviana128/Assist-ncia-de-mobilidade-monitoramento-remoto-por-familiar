import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { TelemetryCards } from './components/TelemetryCards';
import { MapTracker } from './components/MapTracker';
import { AlertCenter } from './components/AlertCenter';
import { RadarWidget } from './components/RadarWidget';
import { AdvancedTelemetryView } from './components/AdvancedTelemetryView';
import { SettingsView } from './components/SettingsView';
import { SimulatorModal } from './components/SimulatorModal';
import { api } from './services/api';
import { DashboardSummary, DeviceStatus, TelemetryPoint } from './types';

export const App: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routeHistory, setRouteHistory] = useState<TelemetryPoint[]>([]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'monitor' | 'telemetry' | 'settings'>('monitor');
  const [geofenceRadius, setGeofenceRadius] = useState(500);

  // Gerenciamento de Tema Escuro / Claro
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('assistmob_theme');
    return saved !== 'light';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-mode');
      localStorage.setItem('assistmob_theme', 'dark');
    } else {
      document.body.classList.add('light-mode');
      localStorage.setItem('assistmob_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const fetchData = async () => {
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);

      if (data.devices.length > 0) {
        const route = await api.getRecentRoute(data.devices[0].deviceId);
        setRouteHistory(route);
      }
    } catch (e) {
      console.error('Falha ao atualizar dados:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleResolveAlert = async (id: number) => {
    await api.resolveAlert(id);
    await fetchData();
  };

  const currentDevice: DeviceStatus | undefined = summary?.devices[0];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Barra de Navegação Superior com Alternador de Tema */}
      <Navbar
        isOnline={currentDevice?.isOnline ?? true}
        pendingAlertsCount={summary?.pendingAlertsCount ?? 0}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main style={{ flex: 1 }}>
        {/* Aba 1: Painel Geral de Monitoramento */}
        {activeTab === 'monitor' && (
          <>
            <TelemetryCards device={currentDevice} />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
              gap: '16px',
              margin: '0 20px 20px 20px'
            }}>
              {/* Mapa com Suporte a Tema Dark / Light */}
              <div>
                <MapTracker
                  device={currentDevice}
                  routeHistory={routeHistory}
                  isDarkMode={isDarkMode}
                  geofenceRadius={geofenceRadius}
                  onLocationUpdated={fetchData}
                />
              </div>

              {/* Radar Sonar e Central de Alertas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <RadarWidget distanceCm={currentDevice?.lastDistanceCm ?? 120} />
                </div>
                <div style={{ flex: 1.3 }}>
                  <AlertCenter
                    alerts={summary?.recentAlerts ?? []}
                    onResolve={handleResolveAlert}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Aba 2: Telemetria Avançada & Diagnóstico dos Sensores IMU */}
        {activeTab === 'telemetry' && (
          <AdvancedTelemetryView device={currentDevice} />
        )}

        {/* Aba 3: Configurações de Cerca Virtual e Contatos */}
        {activeTab === 'settings' && (
          <SettingsView
            geofenceRadius={geofenceRadius}
            onUpdateGeofenceRadius={setGeofenceRadius}
          />
        )}
      </main>

      {/* Modal de Simulação com Presets de Queda, Obstáculo e SOS */}
      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onRefresh={fetchData}
      />
    </div>
  );
};

export default App;
