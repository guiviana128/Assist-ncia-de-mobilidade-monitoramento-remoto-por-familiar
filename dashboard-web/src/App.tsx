import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { TelemetryCards } from './components/TelemetryCards';
import { MapTracker } from './components/MapTracker';
import { AlertCenter } from './components/AlertCenter';
import { RadarWidget } from './components/RadarWidget';
import { SimulatorModal } from './components/SimulatorModal';
import { api } from './services/api';
import { Alert, DashboardSummary, DeviceStatus, TelemetryPoint } from './types';

export const App: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routeHistory, setRouteHistory] = useState<TelemetryPoint[]>([]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Polling dinâmico a cada 4s
    return () => clearInterval(interval);
  }, []);

  const handleResolveAlert = async (id: number) => {
    await api.resolveAlert(id);
    await fetchData();
  };

  const currentDevice: DeviceStatus | undefined = summary?.devices[0];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        isOnline={currentDevice?.isOnline ?? true}
        pendingAlertsCount={summary?.pendingAlertsCount ?? 0}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main style={{ flex: 1 }}>
        <TelemetryCards device={currentDevice} />

        {/* Grade Principal: Mapa em Tempo Real + Radar e Alertas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
          gap: '20px',
          margin: '0 20px 20px 20px'
        }}>
          {/* Coluna Esquerda: Mapa com GPS e Geofence */}
          <div>
            <MapTracker device={currentDevice} routeHistory={routeHistory} />
          </div>

          {/* Coluna Direita: Radar Sonar Frontal + Feed de Alertas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <RadarWidget distanceCm={currentDevice?.lastDistanceCm ?? 120} />
            </div>
            <div style={{ flex: 1.4 }}>
              <AlertCenter
                alerts={summary?.recentAlerts ?? []}
                onResolve={handleResolveAlert}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Simulação de Hardware */}
      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onRefresh={fetchData}
      />
    </div>
  );
};

export default App;
