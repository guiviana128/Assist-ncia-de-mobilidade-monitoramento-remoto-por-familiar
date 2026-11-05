import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveMonitoringView } from './components/LiveMonitoringView';
import { HouseView3D } from './components/HouseView3D';
import { LoginScreen } from './components/LoginScreen';
import { TelemetryCards } from './components/TelemetryCards';
import { MapTracker } from './components/MapTracker';
import { AlertCenter } from './components/AlertCenter';
import { AdvancedTelemetryView } from './components/AdvancedTelemetryView';
import { SettingsView } from './components/SettingsView';
import { SimulatorModal } from './components/SimulatorModal';
import { Navbar, TopoMobile, BarraInferior } from './components/layout/Navbar';
import { FaixaEmergencia } from './components/layout/FaixaEmergencia';
import { MenuConta } from './components/layout/MenuConta';
import { ABA_PADRAO, type AppTab, type AppView } from './components/layout/navegacao';
import { Camada } from './components/ui/Camada';
import { FraseEstado } from './components/ui/FraseEstado';
import type { EstadoConexao } from './components/ui/StatusConexao';
import { auth, AuthRequiredError } from './services/auth';
import { api } from './services/api';
import { useRobo } from './hooks/useRobo';
import { ATE_TABLET, CELULAR, useMediaQuery } from './hooks/useMediaQuery';
import { comodoCurto, emergenciaPendente, haQuanto, nomePessoa, resumoDoEstado, TITULO_EMERGENCIA } from './lib/resumoDoEstado';
import { DashboardSummary, TelemetryPoint } from './types';

type CamadaAberta = null | 'avisos' | 'conta' | 'simulador';

export const App: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routeHistory, setRouteHistory] = useState<TelemetryPoint[]>([]);
  const [view, setView] = useState<AppView>(ABA_PADRAO);
  const [camada, setCamada] = useState<CamadaAberta>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [username, setUsername] = useState<string | null>(auth.username);
  const [geofenceRadius, setGeofenceRadius] = useState(500);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [routeDemo, setRouteDemo] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(false);
  const celular = useMediaQuery(CELULAR);
  const ateTablet = useMediaQuery(ATE_TABLET);
  const robo = useRobo();

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
    } catch (e) {
      if (e instanceof AuthRequiredError) {
        if (mounted.current) setNeedsLogin(true);
        return;
      }
      if (mounted.current) setError('Não foi possível atualizar. Os dados anteriores podem estar desatualizados.');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Atualização automática a cada 3,5 s
  useEffect(() => {
    mounted.current = true;
    void fetchData();
    const interval = window.setInterval(() => void fetchData(), 3500);
    return () => { mounted.current = false; window.clearInterval(interval); };
  }, [fetchData]);

  useEffect(() => auth.onChange(() => {
    setUsername(auth.username);
    if (!auth.isLoggedIn()) setNeedsLogin(true);
  }), []);

  // Volta ao topo ao trocar de tela
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const handleResolveAlert = async (id: number) => {
    try { await api.resolveAlert(id); await fetchData(); }
    catch { setError('Não foi possível confirmar a resolução do alerta. Tente novamente.'); }
  };

  const device = summary?.devices[0];
  const alerts = useMemo(() => summary?.recentAlerts ?? [], [summary]);
  const emergency = emergenciaPendente(alerts);
  const pessoa = nomePessoa(device);
  const conexao: EstadoConexao = demo ? 'demonstracao' : device?.isOnline ? 'conectado' : loading ? 'demonstracao' : 'sem-conexao';
  const resumo = resumoDoEstado({
    carregando: loading, demo, device, alerts, robot: robo.robot, layout: robo.layout,
    noComodoDesde: robo.noComodoDesde, atualizado: updated
  });

  const fecharCamada = useCallback(() => setCamada(null), []);
  const alternar = (c: Exclude<CamadaAberta, null>) => setCamada(atual => atual === c ? null : c);
  const irPara = (v: AppView) => { setView(v); setCamada(null); };

  if (needsLogin) {
    return <LoginScreen onLoggedIn={() => { setNeedsLogin(false); setLoading(true); setView(ABA_PADRAO); void fetchData(); }}
      onContinueDemo={() => setNeedsLogin(false)} />;
  }

  const faixa = emergency ? (() => {
    const onde = comodoCurto(robo.layout, emergency.indoorRoom);
    const titulo = `${TITULO_EMERGENCIA[emergency.alertType] ?? 'Pedido de socorro'}${onde ? ` na ${onde}` : ''}`;
    const robot = robo.robot?.mode === 'RESPONDING' ? `o robô assistente está indo até ${pessoa}`
      : robo.robot?.mode === 'CHECKING_PERSON' ? `o robô assistente está ao lado de ${pessoa}` : 'confirme se alguém pode ir até ele';
    const detalhe = `${haQuanto(emergency.createdAt)} · ${robot}`;
    return <FaixaEmergencia titulo={titulo} detalhe={detalhe} demo={demo} compacta={ateTablet} onVerCasa={() => irPara('casa')} />;
  })() : undefined;

  const botoesTopo = {
    avisosPendentes: summary?.pendingAlertsCount ?? 0,
    avisosAbertos: camada === 'avisos',
    contaAberta: camada === 'conta',
    usuario: username,
    onAvisos: () => alternar('avisos'),
    onConta: () => alternar('conta')
  };

  const selecionar = (tab: AppTab) => irPara(tab);

  return (
    <div className={`app${emergency ? ' is-emergencia' : ''}${demo ? ' is-demonstracao' : ''}`}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      {ateTablet
        ? <TopoMobile conexao={conexao} faixa={faixa} {...botoesTopo} />
        : <Navbar view={view} conexao={conexao} onSelecionar={selecionar} faixa={faixa} {...botoesTopo} />}

      <main id="conteudo" className="pagina" tabIndex={-1}>
        {error && <p className="nota is-aviso" role="status">{error}</p>}
        {loading && !summary ? (
          <div className="estado-vazio" aria-busy="true"><span className="carregando" aria-hidden="true" />Carregando a casa e os avisos…</div>
        ) : !device ? (
          <div className="estado-vazio painel"><h3>Nenhuma bengala cadastrada</h3><p>Confira o cadastro e a conexão do dispositivo.</p></div>
        ) : <>
          {view === 'inicio' && <>
            <FraseEstado tom={resumo.tom} forte={resumo.forte} apoio={resumo.apoio} detalhe={resumo.detalhe} indicador />
            <TelemetryCards device={device} />
            <div className="monitor-grid">
              <MapTracker device={device} routeHistory={routeHistory} isDarkMode={false} geofenceRadius={geofenceRadius} onLocationUpdated={fetchData} />
              <AlertCenter alerts={alerts} onResolve={handleResolveAlert} />
            </div>
          </>}
          {view === 'casa' && <HouseView3D alerts={alerts} isDarkMode={false} />}
          {view === 'monitorar' && <>
            <AdvancedTelemetryView device={device} />
            {routeDemo && <p className="nota">Trajeto com dados demonstrativos.</p>}
          </>}
          {view === 'camera' && <LiveMonitoringView device={device} onTriggerAlert={() => { void fetchData(); }} />}
          {view === 'configuracoes' && <SettingsView geofenceRadius={geofenceRadius} onUpdateGeofenceRadius={setGeofenceRadius} deviceId={device.deviceId} />}
        </>}
      </main>

      {ateTablet && <BarraInferior view={view} onSelecionar={selecionar} />}

      <Camada aberta={camada === 'avisos'} onFechar={fecharCamada} modo={celular ? 'folha' : 'popover'} titulo="Avisos" className="camada-avisos">
        <AlertCenter alerts={alerts} onResolve={handleResolveAlert} />
      </Camada>
      <Camada aberta={camada === 'conta'} onFechar={fecharCamada} modo={celular ? 'folha' : 'popover'} titulo="Sua conta"
        semCabecalho={!celular} className="camada-conta">
        <MenuConta usuario={username} pessoa={pessoa} emConfiguracoes={view === 'configuracoes'}
          onConfiguracoes={() => irPara('configuracoes')} onSimulador={() => setCamada('simulador')}
          onSair={() => { setCamada(null); void auth.logout(); }} />
      </Camada>
      <SimulatorModal isOpen={camada === 'simulador'} onClose={fecharCamada} onRefresh={fetchData} />
    </div>
  );
};
export default App;
