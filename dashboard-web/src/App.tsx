import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LiveMonitoringView } from './components/LiveMonitoringView';
import { HouseView3D } from './components/HouseView3D';
import { LoginScreen } from './components/LoginScreen';
import { InicioView } from './components/inicio/InicioView';
import { MonitorarView } from './components/monitorar/MonitorarView';
import { CentralAvisos } from './components/avisos/CentralAvisos';
import { ConfiguracoesView } from './components/configuracoes/ConfiguracoesView';
import { Simulador } from './components/simulador/Simulador';
import { robotApi } from './services/robotApi';
import { avisosVistos } from './lib/vistos';
import { Navbar, TopoMobile, BarraInferior } from './components/layout/Navbar';
import { FaixaEmergencia } from './components/layout/FaixaEmergencia';
import { MenuConta } from './components/layout/MenuConta';
import { ABA_PADRAO, type AppTab, type AppView } from './components/layout/navegacao';
import { Camada } from './components/ui/Camada';
import type { EstadoConexao } from './components/ui/StatusConexao';
import { auth, AuthRequiredError } from './services/auth';
import { api } from './services/api';
import { useRobo } from './hooks/useRobo';
import { ATE_TABLET, CELULAR, useMediaQuery } from './hooks/useMediaQuery';
import { comodoCurto, naNo, emergenciaPendente, haQuanto, nomePessoa, resumoDoEstado, TITULO_EMERGENCIA } from './lib/resumoDoEstado';
import { DashboardSummary, TelemetryPoint } from './types';
import { DESLOCA, DUR, EASE_MOTION, saida } from './motion/tokens';

type CamadaAberta = null | 'avisos' | 'conta' | 'simulador';

const CROSSFADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.media, ease: EASE_MOTION } },
  exit: { opacity: 0, transition: { duration: saida(DUR.media), ease: EASE_MOTION } }
};

/** Troca de aba: o conteúdo novo entra com fade + 8 px para cima (200 ms); o antigo sai só com fade (140 ms). */
const VISTA = {
  initial: { opacity: 0, y: DESLOCA },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.curta, ease: EASE_MOTION } },
  exit: { opacity: 0, transition: { duration: saida(DUR.curta), ease: EASE_MOTION } }
};

export const App: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routeHistory, setRouteHistory] = useState<TelemetryPoint[]>([]);
  const [view, setView] = useState<AppView>(ABA_PADRAO);
  const [camada, setCamada] = useState<CamadaAberta>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [username, setUsername] = useState<string | null>(auth.username);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [routeDemo, setRouteDemo] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [esqueleto, setEsqueleto] = useState(false);
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

  // Esqueleto só se a primeira carga passar de 300 ms (evita piscar em respostas rápidas)
  const esperando = loading && !summary;
  useEffect(() => {
    if (!esperando) { setEsqueleto(false); return; }
    const timer = window.setTimeout(() => setEsqueleto(true), 300);
    return () => window.clearTimeout(timer);
  }, [esperando]);

  useEffect(() => auth.onChange(() => {
    setUsername(auth.username);
    if (!auth.isLoggedIn()) setNeedsLogin(true);
  }), []);

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
  const [comodoCasa, setComodoCasa] = useState<string | null>(null);
  const abrirCasa = (roomId?: string) => { setComodoCasa(roomId ?? null); irPara('casa'); };


  const faixa = emergency ? (() => {
    const onde = comodoCurto(robo.layout, emergency.indoorRoom);
    const titulo = emergency.alertType === 'HAND_GESTURE_SOS'
      ? `Pedido de ajuda pela câmera${onde ? `, ${naNo(onde)}` : ''}`
      : `${TITULO_EMERGENCIA[emergency.alertType] ?? 'Pedido de socorro'}${onde ? ` ${naNo(onde)}` : ''}`;
    const robot = robo.robot?.mode === 'RESPONDING' ? `o robô assistente está indo até ${pessoa}`
      : robo.robot?.mode === 'CHECKING_PERSON' ? `o robô assistente está ao lado de ${pessoa}`
        : emergency.alertType === 'HAND_GESTURE_SOS' ? 'ninguém foi chamado ainda' : 'confirme se alguém pode ir até ele';
    const detalhe = `${haQuanto(emergency.createdAt)} · ${robot}`;
    return <FaixaEmergencia titulo={titulo} detalhe={detalhe} demo={demo} compacta={ateTablet} onVerCasa={() => abrirCasa(emergency.indoorRoom ?? undefined)} />;
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

  // Login ⇄ painel: crossfade (só opacidade, para não criar contêiner de position: fixed)
  return (
    <AnimatePresence mode="wait" initial={false}>
    {needsLogin ? (
      <motion.div key="login" {...CROSSFADE}>
        <LoginScreen onLoggedIn={() => { setNeedsLogin(false); setLoading(true); setView(ABA_PADRAO); void fetchData(); }}
          onContinueDemo={() => setNeedsLogin(false)} />
      </motion.div>
    ) : (
    <motion.div key="app" {...CROSSFADE} className={`app${emergency ? ' is-emergencia' : ''}${demo ? ' is-demonstracao' : ''}`}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      {ateTablet
        ? <TopoMobile conexao={conexao} faixa={faixa} {...botoesTopo} />
        : <Navbar view={view} conexao={conexao} onSelecionar={selecionar} faixa={faixa} {...botoesTopo} />}

      <main id="conteudo" className="pagina" tabIndex={-1}>
        {error && <p className="nota is-aviso" role="status">{error}</p>}
        {loading && !summary ? (
          esqueleto ? (
            <div className="esqueleto" aria-busy="true" role="status">
              <span className="sr-only">Carregando a casa e os avisos…</span>
              <span className="esqueleto-bloco esqueleto-linha" />
              <span className="esqueleto-bloco esqueleto-linha is-curta" />
              <div className="esqueleto-paineis">
                <span className="esqueleto-bloco esqueleto-painel" />
                <span className="esqueleto-bloco esqueleto-painel" />
              </div>
            </div>
          ) : <div aria-busy="true" />
        ) : !device ? (
          <div className="estado-vazio painel"><h3>Nenhuma bengala cadastrada</h3><p>Confira o cadastro e a conexão do dispositivo.</p></div>
        ) : (
          <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
          <motion.div key={view} className="pagina-vista" {...VISTA}>
          {view === 'inicio' && <InicioView device={device} alerts={alerts} layout={robo.layout} robot={robo.robot}
            missions={robo.missions} noComodoDesde={robo.noComodoDesde} resumo={resumo} demo={demo}
            onAbrirCasa={abrirCasa} onResolver={id => void handleResolveAlert(id)} />}
          {view === 'casa' && <HouseView3D alerts={alerts} isDarkMode={false} comodoInicial={comodoCasa} pessoa={pessoa} demo={demo} />}
          {view === 'monitorar' && <MonitorarView device={device} alerts={alerts} routeHistory={routeHistory} routeDemo={routeDemo} demo={demo} />}
          {view === 'camera' && <LiveMonitoringView device={device} alerts={alerts} layout={robo.layout} demo={demo}
            onTriggerAlert={() => { void fetchData(); }} onResolver={id => void handleResolveAlert(id)} />}
          {view === 'configuracoes' && <ConfiguracoesView deviceId={device.deviceId} pessoa={pessoa} />}
          </motion.div>
          </AnimatePresence>
        )}
      </main>

      {ateTablet && <BarraInferior view={view} onSelecionar={selecionar} />}

      <Camada aberta={camada === 'avisos'} onFechar={fecharCamada} modo={celular ? 'folha' : 'popover'} titulo="Avisos" className="camada-avisos"
        extra={<button className="btn-link avisos-marcar" onClick={() => avisosVistos.marcar(alerts.map(a => a.id))}>Marcar como vistos</button>}>
        <CentralAvisos alerts={alerts} layout={robo.layout} onResolver={id => void handleResolveAlert(id)} onVerNoMapa={() => irPara('monitorar')} />
      </Camada>
      <Camada aberta={camada === 'conta'} onFechar={fecharCamada} modo={celular ? 'folha' : 'popover'} titulo="Sua conta"
        semCabecalho={!celular} className="camada-conta">
        <MenuConta usuario={username} pessoa={pessoa} emConfiguracoes={view === 'configuracoes'}
          onConfiguracoes={() => irPara('configuracoes')} onSimulador={() => setCamada('simulador')}
          onSair={() => { setCamada(null); void auth.logout(); }} />
      </Camada>
      <Camada aberta={camada === 'simulador'} onFechar={fecharCamada} modo={celular ? 'folha' : 'lateral'} titulo="Simulador da apresentação" className="camada-simulador">
        <Simulador layout={robo.layout} demo={demo} onAtualizar={() => { void fetchData(); void robo.atualizar(); }}
          onSairDemo={() => { setCamada(null); robotApi.stopDemo(); setNeedsLogin(true); }} />
      </Camada>
    </motion.div>
    )}
    </AnimatePresence>
  );
};
export default App;
