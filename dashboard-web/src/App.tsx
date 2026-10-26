import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LiveMonitoringView } from './components/LiveMonitoringView';
import { Navbar } from './components/Navbar';
import { TelemetryCards } from './components/TelemetryCards';
import { MapTracker } from './components/MapTracker';
import { AlertCenter } from './components/AlertCenter';
import { RadarWidget } from './components/RadarWidget';
import { AdvancedTelemetryView } from './components/AdvancedTelemetryView';
import { SettingsView } from './components/SettingsView';
import { SimulatorModal } from './components/SimulatorModal';
import { api } from './services/api';
import { DashboardSummary, TelemetryPoint } from './types';

export const App: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routeHistory, setRouteHistory] = useState<TelemetryPoint[]>([]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'monitor' | 'live' | 'telemetry' | 'settings'>('monitor');
  const [geofenceRadius, setGeofenceRadius] = useState(500);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [routeDemo, setRouteDemo] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { return localStorage.getItem('assistmob_theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.body.classList.toggle('light-mode', !isDarkMode);
    try { localStorage.setItem('assistmob_theme', isDarkMode ? 'dark' : 'light'); } catch { /* Storage may be unavailable. */ }
  }, [isDarkMode]);

  const fetchData = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const data = await api.getDashboardSummary();
      const sourceIsDemo = api.isDemoSummary();
      const route = data.devices.length ? await api.getRecentRoute(data.devices[0].deviceId) : [];
      if (!mounted.current) return;
      setSummary(data);
      setDemo(sourceIsDemo);
      setRouteDemo(data.devices.length > 0 && api.isDemoRoute());
      setRouteHistory(route);
      setUpdated(new Date());
      setError('');
    } catch {
      if (mounted.current) setError('Não foi possível atualizar. Os dados anteriores podem estar desatualizados.');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void fetchData();
    const interval = window.setInterval(() => void fetchData(), 3500);
    return () => { mounted.current = false; window.clearInterval(interval); };
  }, [fetchData]);

  const handleResolveAlert = async (id: number) => {
    try { await api.resolveAlert(id); await fetchData(); }
    catch { setError('Não foi possível confirmar a resolução do alerta. Tente novamente.'); }
  };
  const device = summary?.devices[0];
  const emergency = summary?.recentAlerts.find(alert => alert.status === 'PENDING' && (alert.alertType === 'HAND_GESTURE_SOS' || alert.alertType === 'SOS_BUTTON' || alert.alertType === 'FALL_DETECTED'));
  const titles = { live: 'Câmera e sinal de socorro', monitor: 'Acompanhamento familiar', telemetry: 'Telemetria e sensores', settings: 'Preferências de cuidado' };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <Navbar isOnline={!loading && !demo && !!device?.isOnline}
        pendingAlertsCount={summary?.pendingAlertsCount ?? 0} isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(value => !value)} activeTab={activeTab}
        onSelectTab={setActiveTab} onOpenSimulator={() => setIsSimulatorOpen(true)} deviceId={device?.deviceId} />
      <main id="main-content" className="workspace">
        <section className="page-heading">
          <div><p className="eyebrow">AMPARO / CENTRAL DE CUIDADO</p>
            <h2>{titles[activeTab]}</h2>
            <p className="muted">Informações essenciais para acompanhar quem você ama.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => void fetchData()} disabled={loading}>Atualizar painel</button>
        </section>
        <div className={demo || routeDemo || error ? 'connection-banner is-warning' : 'connection-banner'} role="status">
          <strong>{loading ? 'Conectando ao painel…' : error ? 'Atualização indisponível' : demo ? 'Modo demonstração • API indisponível' : routeDemo ? 'Trajeto demonstrativo • histórico indisponível' : 'Dados recebidos da API'}</strong>
          <span>{demo ? 'Dados de exemplo; não representam monitoramento real.' : routeDemo ? 'O percurso exibido contém dados de exemplo.' : 'A conexão com a API não confirma o funcionamento de todos os sensores.'}</span>
          {updated && <span>Consulta: {updated.toLocaleTimeString('pt-BR')}</span>}
        </div>
        {emergency && <section className="emergency-panel" aria-label="Socorro pendente">
          <div role="alert"><span className="eyebrow">{demo ? 'SIMULAÇÃO DE SOCORRO' : 'SOCORRO RECEBIDO'}</span>
            <h2>{emergency.alertType === 'SOS_BUTTON' ? 'Pedido de SOS acionado' : 'Alerta de queda recebido'}</h2>
            <p>{emergency.message}</p>
            <p>Dispositivo: {emergency.deviceId} · {new Date(emergency.createdAt).toLocaleString('pt-BR')}</p>
            <p>Localização informada: {emergency.latitude.toFixed(6)}, {emergency.longitude.toFixed(6)}</p>
          </div>
          <div className="emergency-actions">
            {demo ? <span className="badge badge-warning">Teste: nenhuma ligação será iniciada</span> : <a className="btn btn-danger" href="tel:192">Ligar para emergência · SAMU 192</a>}
            <button className="btn btn-secondary" onClick={() => setActiveTab('monitor')}>Ver ocorrência no painel</button>
          </div>
          <p className="muted">{demo ? 'O botão de ligação fica disponível para ocorrências recebidas da API.' : 'Abre o discador do aparelho. A chamada depende da confirmação e do suporte do dispositivo.'}</p>
        </section>}
        {error && <p className="feedback-error" role="alert">{error}</p>}
        {loading ? <div className="empty-state" aria-busy="true">Carregando dispositivos e alertas…</div> :
          !device ? <div className="empty-state"><h3>Nenhum dispositivo disponível</h3><p>Verifique o cadastro e a conexão da bengala.</p></div> : <>
            <section className="person-strip" aria-label="Dispositivo acompanhado">
              <div className="person-avatar" aria-hidden="true">A</div>
              <div><strong>{device.name}</strong><p className="muted">{device.deviceId}</p></div>
              <div className="person-status"><span className="eyebrow">ÚLTIMA TELEMETRIA</span><p>{device.lastUpdate ? new Date(device.lastUpdate).toLocaleString('pt-BR') : 'Sem data informada'}</p></div>
              <span className="badge badge-warning">{summary?.pendingAlertsCount ?? 0} alertas pendentes</span>
            </section>
            {activeTab === 'monitor' && <>
              <TelemetryCards device={device} />
              <div className="monitor-grid">
                <MapTracker device={device} routeHistory={routeHistory} isDarkMode={isDarkMode} geofenceRadius={geofenceRadius} onLocationUpdated={fetchData} />
                <div className="monitor-aside"><AlertCenter alerts={summary?.recentAlerts ?? []} onResolve={handleResolveAlert} />{device.lastDistanceCm != null && <RadarWidget distanceCm={device.lastDistanceCm} />}</div>
              </div>
            </>}
            {activeTab === 'live' && <LiveMonitoringView device={device} onTriggerAlert={() => { void fetchData(); }} />}
            {activeTab === 'telemetry' && <AdvancedTelemetryView device={device} />}
            {activeTab === 'settings' && <><p className="section-notice">Preferências desta sessão: listas de medicamentos e áreas de exemplo não são um cadastro persistente.</p><SettingsView geofenceRadius={geofenceRadius} onUpdateGeofenceRadius={setGeofenceRadius} deviceId={device.deviceId} /></>}
          </>}
        <footer className="workspace-footer">Amparo · Mobilidade e cuidado familiar <span>Atualização automática a cada 3,5 segundos</span></footer>
      </main>
      <SimulatorModal isOpen={isSimulatorOpen} onClose={() => setIsSimulatorOpen(false)} onRefresh={fetchData} />
    </div>
  );
};
export default App;

