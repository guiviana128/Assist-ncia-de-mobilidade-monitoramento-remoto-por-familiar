import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Glasses, Home, Layers, Lock, MapPin, Maximize2, Minus, Phone, Plus, RotateCcw, Route, WifiOff, X } from 'lucide-react';
import type { Alert } from '../types';
import type { HouseLayout, MissionRequest, Point2D, RobotMission, RobotState, Room } from '../types/robot';
import { HouseScene } from './house3d/HouseScene';
import { FALLBACK_LAYOUT, findRoom, pathLength, planPath, roomAt, roomName } from '../robot/houseLayout';
import { robotApi } from '../services/robotApi';
import { ApiError, AuthRequiredError } from '../services/auth';
import { ATE_TABLET, CELULAR, useMediaQuery } from '../hooks/useMediaQuery';
import { artigo, comodoCurto, deComodo, emergenciaPendente, haQuanto, naNo } from '../lib/resumoDoEstado';
import { horaCurta } from '../lib/avisos';
import { useCuidado } from '../lib/cuidado';
import { PassosMissao, MarcadorRoboIcone, type Passo } from './ui/PassoMissao';
import { Flip, movimentoReduzido, useGSAP } from '../motion/gsap';
import { zoomCasa } from '../motion/zoomCasa';
import { EASE_GSAP } from '../motion/tokens';

interface HouseView3DProps {
  alerts: Alert[];
  isDarkMode: boolean;
  /** Cômodo tocado na planta do Início: fica destacado ao abrir. */
  comodoInicial?: string | null;
  pessoa?: string;
  demo?: boolean;
}

const MODE_LABEL: Record<RobotState['mode'], string> = {
  IDLE: 'Parado na base',
  PATROLLING: 'Patrulhando',
  RESPONDING: 'Atendendo socorro',
  CHECKING_PERSON: 'Verificando a pessoa',
  GOING_TO_GOAL: 'Em missão',
  RETURNING: 'Voltando à base',
  OFFLINE: 'Desconhecido'
};

const MISSION_LABEL: Record<RobotMission['type'], string> = {
  RESPOND_TO_ALERT: 'Socorro',
  GO_TO_ROOM: 'Ir ao cômodo',
  GO_TO_POINT: 'Ir ao ponto',
  RETURN_TO_DOCK: 'Voltar à base',
  PATROL: 'Patrulhar'
};

const STATUS_LABEL: Record<RobotMission['status'], string> = {
  PENDING: 'Na fila',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelada'
};

type Camada = 'patrulha' | 'socorro' | 'comando' | 'lidar';
const CAMADAS: { id: Camada; rotulo: string }[] = [
  { id: 'patrulha', rotulo: 'Patrulha' },
  { id: 'socorro', rotulo: 'Socorro' },
  { id: 'comando', rotulo: 'Comando' },
  { id: 'lidar', rotulo: 'LiDAR' }
];
const camadaDaMissao = (m: RobotMission): Camada =>
  m.type === 'RESPOND_TO_ALERT' ? 'socorro' : m.type === 'PATROL' ? 'patrulha' : 'comando';
const COR_CAMADA: Record<Camada, string> = { patrulha: '#10b981', socorro: '#dc2626', comando: '#2563eb', lidar: '#22d3ee' };

/** Velocidade média usada só para estimar a chegada (o robô simulado anda a 0,7 m/s). */
const VELOCIDADE_MEDIA = 0.6;
/** O aviso de comando some sozinho depois de 6 s. */
const DURACAO_AVISO_MS = 6000;
/** Zoom do cômodo da planta até a vista da Casa 3D (s). */
const ZOOM_CASA = 0.4;

const errorMessage = (error: unknown) =>
  error instanceof ApiError || error instanceof Error ? error.message : 'Não foi possível enviar o comando.';

const metros = (m: number) => `${m < 10 ? m.toFixed(1).replace('.', ',') : Math.round(m)} m`;
const chegada = (m: number) => `chega em ~${Math.max(5, Math.round(m / VELOCIDADE_MEDIA / 5) * 5)} s`;

type Pendente = { ponto: Point2D; room?: Room };

export const HouseView3D: React.FC<HouseView3DProps> = ({ alerts, isDarkMode, comodoInicial, pessoa = 'José', demo }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const vistaRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HouseScene | null>(null);
  /** Quando termina o zoom de entrada (performance.now), para a cena 3D esperar por ele. */
  const zoomAte = useRef(0);
  const celular = useMediaQuery(CELULAR);
  const ateTablet = useMediaQuery(ATE_TABLET);
  const { telefonePessoa } = useCuidado();

  const [layout, setLayout] = useState<HouseLayout>(FALLBACK_LAYOUT);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [ultimoContato, setUltimoContato] = useState<{ quando: number; room?: string | null } | null>(null);
  const [missions, setMissions] = useState<RobotMission[]>([]);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [hoverRoom, setHoverRoom] = useState<string | null>(comodoInicial ?? null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [inAR, setInAR] = useState(false);
  const [sceneError, setSceneError] = useState('');
  const [camadas, setCamadas] = useState<Record<Camada, boolean>>({ patrulha: true, socorro: true, comando: true, lidar: true });
  const [trocado, setTrocado] = useState<boolean | null>(null);
  const [historico, setHistorico] = useState(false);
  const [reconectando, setReconectando] = useState(false);
  /** Muda quando a cena 3D fica pronta, para reaplicar robô, destino e camadas. */
  const [cenaPronta, setCenaPronta] = useState(0);

  const emergency = useMemo(() => emergenciaPendente(alerts), [alerts]);

  // Veio de um cômodo tocado na planta do Início: a vista cresce a partir dele (Flip, 400 ms).
  // Com movimento reduzido fica só o fade da troca de aba.
  useGSAP(() => {
    const estado = zoomCasa.retirar();
    const vista = vistaRef.current;
    if (!estado || !vista || movimentoReduzido()) return;
    vista.setAttribute('data-flip-id', 'zoom-casa');
    zoomAte.current = performance.now() + ZOOM_CASA * 1000;
    Flip.from(estado, { targets: vista, duration: ZOOM_CASA, ease: EASE_GSAP, scale: true, clearProps: 'transform' });
    vista.removeAttribute('data-flip-id');
  }, []);

  // ---------------------------------------------------------------- dados
  useEffect(() => {
    let active = true;
    robotApi.getLayout().then(l => { if (active) setLayout(l); }).catch(() => undefined);
    void HouseScene.isARSupported().then(ok => { if (active) setArSupported(ok); });
    return () => { active = false; };
  }, []);

  const refreshMissions = useCallback(async () => {
    try { setMissions(await robotApi.listMissions(6)); } catch { /* mantém a lista anterior; login é tratado no App */ }
  }, []);

  const pollState = useCallback(async () => {
    try {
      const state = await robotApi.getState();
      setRobot(state);
      if (state.online) setUltimoContato({ quando: Date.now(), room: state.currentRoom });
    } catch { /* App trata AuthRequiredError; outras falhas: tenta de novo no próximo ciclo */ }
  }, []);

  useEffect(() => {
    void pollState();
    void refreshMissions();
    const stateTimer = window.setInterval(() => void pollState(), 1000);
    const missionTimer = window.setInterval(() => void refreshMissions(), 3000);
    return () => { window.clearInterval(stateTimer); window.clearInterval(missionTimer); };
  }, [pollState, refreshMissions]);

  // O aviso de comando ("Comando guardado na fila…") some sozinho depois de 6 s
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), DURACAO_AVISO_MS);
    return () => window.clearTimeout(t);
  }, [feedback]);

  // ---------------------------------------------------------------- cena 3D
  const handleFloorClick = useCallback((point: Point2D) => {
    setPendente({ ponto: point });
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !eyesRef.current) return;
    let scene: HouseScene | null = null;
    const criar = () => {
      if (!containerRef.current || !eyesRef.current) return;
      try {
        scene = new HouseScene({
          container: containerRef.current,
          eyesContainer: eyesRef.current,
          layout,
          dark: isDarkMode,
          onFloorClick: point => handleFloorClick(point),
          onARChange: setInAR
        });
        sceneRef.current = scene;
        setSceneError('');
        setCenaPronta(v => v + 1);
      } catch (error) {
        console.error('[Casa 3D] WebGL indisponível', error);
        setSceneError(errorMessage(error));
      }
    };
    // Montar o WebGL trava a página por alguns quadros: se a vista está crescendo a partir do cômodo (Flip),
    // a cena só é criada quando o zoom termina, para ele não engasgar.
    const espera = Math.max(0, zoomAte.current - performance.now());
    const timer = espera ? window.setTimeout(criar, espera) : (criar(), 0);
    return () => { window.clearTimeout(timer); scene?.dispose(); if (sceneRef.current === scene) sceneRef.current = null; };
    // isDarkMode é aplicado no efeito abaixo; recriar a cena só quando a planta mudar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, handleFloorClick]);

  useEffect(() => { sceneRef.current?.setDark(isDarkMode); }, [isDarkMode, cenaPronta]);
  useEffect(() => { sceneRef.current?.setPendingPoint(pendente?.ponto ?? null); }, [pendente, cenaPronta]);
  useEffect(() => { sceneRef.current?.setHighlightRoom(pendente?.room?.id ?? hoverRoom); }, [hoverRoom, pendente, cenaPronta]);
  useEffect(() => { sceneRef.current?.setLidarVisible(camadas.lidar); }, [camadas.lidar, cenaPronta]);

  const personRoom = emergency?.indoorRoom ?? robot?.personRoom ?? null;
  const mission = robot?.currentMission ?? null;
  const online = !!robot?.online && robot.mode !== 'OFFLINE';
  const socorro = !!emergency || mission?.type === 'RESPOND_TO_ALERT';

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !robot) return;
    scene.setRobot(robot);
    scene.setPerson({ roomId: personRoom, emergency: !!emergency, fallen: emergency?.alertType === 'FALL_DETECTED', name: pessoa });
    if (mission?.targetX != null && mission.targetY != null && camadas[camadaDaMissao(mission)]) {
      const goal = { x: mission.targetX, y: mission.targetY };
      scene.setGoal(goal, planPath(layout, robot, goal), COR_CAMADA[camadaDaMissao(mission)]);
    } else {
      scene.setGoal(null, []);
    }
  }, [robot, emergency, personRoom, mission, layout, camadas, pessoa, cenaPronta]);

  // Em socorro a câmera do robô vira a vista principal (a pessoa pode trocar de volta)
  // A troca de vistas é só do computador; no tablet e no celular a câmera do robô tem painel próprio
  const vistaTrocada = !ateTablet && (trocado ?? socorro);
  useEffect(() => { setTrocado(null); }, [socorro]);

  // ---------------------------------------------------------------- comandos
  const send = async (request: MissionRequest, success: string) => {
    setBusy(true);
    try {
      const created = await robotApi.requestMission(request);
      setFeedback(created.status === 'CANCELLED'
        ? { text: created.resultMessage ?? 'O robô não aceitou o comando agora.', error: true }
        : { text: online ? success : 'Comando guardado na fila. O robô cumpre assim que voltar a se conectar.' });
      setPendente(null);
      void refreshMissions();
    } catch (error) {
      if (!(error instanceof AuthRequiredError)) setFeedback({ text: errorMessage(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const cancelCurrent = async () => {
    if (!mission) return;
    setBusy(true);
    try {
      await robotApi.cancelMission(mission.id);
      setFeedback({ text: 'Missão cancelada. O robô volta à ronda.' });
      void refreshMissions();
    } catch (error) {
      if (!(error instanceof AuthRequiredError)) setFeedback({ text: errorMessage(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const enviarPendente = () => {
    if (!pendente) return;
    const { ponto, room } = pendente;
    if (room) void send({ type: 'GO_TO_ROOM', targetRoom: room.id }, `Robô a caminho: ${room.name}.`);
    else void send({ type: 'GO_TO_POINT', targetX: Number(ponto.x.toFixed(2)), targetY: Number(ponto.y.toFixed(2)), reason: 'Ponto escolhido na planta 3D' }, 'Robô a caminho do ponto escolhido.');
  };

  const enterAR = async () => {
    if (!sceneRef.current || !overlayRef.current) return;
    try {
      setInAR(true); // o overlay precisa estar visível antes de a sessão começar
      await sceneRef.current.enterAR(overlayRef.current);
    } catch (error) {
      setInAR(false);
      setFeedback({ text: `Não foi possível abrir o AR: ${errorMessage(error)}`, error: true });
    }
  };

  const telaCheia = () => {
    const el = vistaRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  const reconectar = async () => {
    setReconectando(true);
    await Promise.all([pollState(), refreshMissions()]);
    setReconectando(false);
  };

  // ---------------------------------------------------------------- textos
  const pendingRoom = pendente ? (pendente.room ?? roomAt(layout, pendente.ponto)) : undefined;
  const distPendente = pendente && robot ? pathLength(planPath(layout, robot, pendente.ponto)) : null;
  const alvoMissao = mission?.targetX != null && mission.targetY != null ? { x: mission.targetX, y: mission.targetY } : null;
  const distMissao = alvoMissao && robot ? pathLength(planPath(layout, robot, alvoMissao)) : null;
  const destinoMissao = comodoCurto(layout, mission?.targetRoom) ?? (alvoMissao ? 'ponto escolhido' : null);
  const comodoRobo = comodoCurto(layout, robot?.currentRoom);
  const ondePessoa = comodoCurto(layout, personRoom);

  const cabecalho = (() => {
    if (!robot) return { titulo: 'Conectando ao robô', forte: 'Conectando ao robô.', apoio: '', detalhe: 'Buscando a posição e os sensores…', tom: 'neutro' };
    if (!online) {
      const ultima = ultimoContato ? `${haQuanto(ultimoContato.quando)}` : '';
      const onde = comodoCurto(layout, ultimoContato?.room ?? robot.currentRoom);
      return {
        titulo: 'Robô sem conexão', forte: 'Robô fora do ar.', apoio: ` A bengala continua protegendo o ${pessoa}.`, tom: 'offline',
        detalhe: celular
          ? `${ultimoContato ? `Último contato às ${horaCurta(ultimoContato.quando)}` : 'Sem contato desde que o painel abriu'} · comandos ficam na fila`
          : `${onde ? `Última posição conhecida: ${onde}` : 'Sem posição conhecida'}${ultima ? ` · ${ultima}` : ''}`
      };
    }
    const eta = distMissao != null ? chegada(distMissao) : '';
    if (mission?.type === 'RESPOND_TO_ALERT' || robot.mode === 'RESPONDING') {
      return {
        titulo: 'Robô atendendo um socorro', forte: `Robô indo até o ${pessoa}.`, apoio: eta ? ` ${eta.charAt(0).toUpperCase()}${eta.slice(1)}.` : '', tom: 'socorro',
        detalhe: `Indo até ${pessoa}${ondePessoa ? `, ${naNo(ondePessoa)}` : ''}${eta ? ` · ${eta}` : ''}`
      };
    }
    if (robot.mode === 'CHECKING_PERSON') {
      return { titulo: `Robô ao lado do ${pessoa}`, forte: `Robô ao lado do ${pessoa}.`, apoio: ' A câmera está apontada para ele.', tom: 'socorro', detalhe: `${ondePessoa ? `${ondePessoa} · ` : ''}veja pelos olhos do robô` };
    }
    if (mission && mission.type !== 'PATROL') {
      const para = mission.type === 'RETURN_TO_DOCK' ? 'a base' : destinoMissao ? artigo(destinoMissao) : 'o destino';
      const pedido = `${mission.requestedBy ? `Pedido por ${mission.requestedBy}` : 'Você mandou'} às ${horaCurta(mission.createdAt)}`;
      return {
        titulo: `Robô indo para ${para}`, forte: `Robô indo até ${para}.`,
        apoio: eta ? ` ${eta.replace('chega em', 'Chega em')}.` : '', tom: 'missao',
        detalhe: celular ? `${pedido}${robot.nearestObstacleM != null ? ` · obstáculo mais perto a ${metros(robot.nearestObstacleM)}` : ''}` : `${pedido}${eta ? ` · ${eta}` : ''}`
      };
    }
    if (robot.mode === 'PATROLLING' || mission?.type === 'PATROL') {
      return {
        titulo: 'Robô fazendo a ronda', forte: 'Robô na ronda.', apoio: comodoRobo ? ` Agora ${naNo(comodoRobo)}.` : '', tom: 'patrulha',
        detalhe: celular
          ? `${demo || robotApi.isDemo() ? 'Robô simulado' : 'Robô conectado (ROS 2)'}${robot.nearestObstacleM != null ? ` · obstáculo mais perto a ${metros(robot.nearestObstacleM)}` : ''}`
          : `${comodoRobo ? `Agora ${naNo(comodoRobo)} · ` : ''}${robot.batteryPercent != null ? `bateria ${Math.round(robot.batteryPercent)}% · ` : ''}atualizado ${haQuanto(robot.lastUpdate ?? Date.now())}`
      };
    }
    return {
      titulo: 'Robô na base', forte: 'Robô na base.', apoio: ' Pronto para um comando.', tom: 'patrulha',
      detalhe: `${robot.batteryPercent != null ? `Bateria ${Math.round(robot.batteryPercent)}% · ` : ''}${MODE_LABEL[robot.mode]}`
    };
  })();

  const seloVista = !robot ? { t: 'Conectando…', c: 'is-neutro' } : !online ? { t: 'Sem conexão', c: 'is-neutro' }
    : socorro ? { t: 'Atendendo socorro', c: 'is-perigo' } : mission && mission.type !== 'PATROL' ? { t: 'Em missão', c: 'is-acento' }
      : { t: demo || robotApi.isDemo() ? 'Robô simulado' : 'Robô conectado', c: 'is-sucesso' };

  // Passos da missão (PassoMissao)
  const passos: Passo[] | null = (() => {
    if (!mission) return null;
    if (mission.type === 'RESPOND_TO_ALERT' || emergency) {
      const verificando = robot?.mode === 'CHECKING_PERSON';
      return [
        { estado: 'feito', titulo: emergency?.alertType === 'FALL_DETECTED' ? 'Alerta de queda recebido' : 'Pedido de socorro recebido', detalhe: `${horaCurta(emergency?.createdAt ?? mission.createdAt)} · ${emergency?.alertType === 'HAND_GESTURE_SOS' ? 'câmera' : `bengala do ${pessoa}`}` },
        { estado: verificando ? 'feito' : 'socorro', titulo: `Indo até ${pessoa}`, detalhe: verificando ? 'Chegou' : `${ondePessoa ?? 'Casa'}${distMissao != null ? ` · ${chegada(distMissao)}` : ''}` },
        { estado: verificando ? 'socorro' : 'pendente', titulo: 'Verificar a pessoa', detalhe: `Câmera apontada para o ${pessoa}` }
      ];
    }
    if (mission.type === 'PATROL') return null;
    const de = mission.type === 'RETURN_TO_DOCK' ? 'da base' : destinoMissao ? deComodo(destinoMissao) : 'do destino';
    const emAndamento = mission.status === 'IN_PROGRESS';
    return [
      { estado: 'feito', titulo: 'Comando recebido', detalhe: `${horaCurta(mission.createdAt)}${mission.requestedBy ? ` · por ${mission.requestedBy}` : ''}` },
      { estado: emAndamento ? 'atual' : 'pendente', titulo: emAndamento ? `A caminho ${de}` : 'Na fila do robô', detalhe: distMissao != null ? `${metros(distMissao)} · ${chegada(distMissao)}` : undefined },
      { estado: 'pendente', titulo: 'Chegou', detalhe: 'Avisa aqui quando chegar' }
    ];
  })();

  const statusComodo = (room: Room): string => {
    if (!online) return room.id === (ultimoContato?.room ?? robot?.currentRoom) ? 'Última posição' : '—';
    if (mission?.targetRoom === room.id && mission.type !== 'PATROL') return 'Destino';
    if (room.id === personRoom) return emergency ? `${pessoa} precisa de ajuda` : `${pessoa} está aqui`;
    if (room.id === robot?.currentRoom) return mission && mission.type !== 'PATROL' ? 'Robô saindo' : 'Robô está aqui';
    return room.id === 'sala' && celular ? 'Vazia' : 'Vazio';
  };

  const bloqueado = socorro;

  return (
    <section className={`casa3d${socorro ? ' is-socorro' : ''}${!online && robot ? ' is-offline' : ''}`} aria-label="Casa 3D">
      {/* Contexto do robô */}
      <header className={`casa3d-contexto is-${cabecalho.tom}`}>
        {!celular && <MarcadorRoboIcone estado={!online && robot ? 'offline' : socorro ? 'socorro' : 'patrulha'} />}
        <div className="casa3d-contexto-texto">
          {celular
            ? <h1 className="frase">{cabecalho.forte}<span className="frase-apoio">{cabecalho.apoio}</span></h1>
            : <h1 className="casa3d-titulo">{cabecalho.titulo}</h1>}
          <p className="casa3d-detalhe">{cabecalho.detalhe}</p>
        </div>
        {!celular && (
          <div className="casa3d-contexto-acoes">
            <button className="btn btn-secundario" onClick={() => void enterAR()} disabled={!arSupported}
              title={arSupported ? 'Abrir a maquete da casa em realidade aumentada' : 'Abra pelo Chrome no Android, via HTTPS (npm run dev:https)'}>
              <Glasses size={20} aria-hidden="true" />Ver em AR
            </button>
            <button className="btn-icone is-borda" onClick={telaCheia} aria-label="Tela cheia" title="Tela cheia"><Maximize2 size={20} /></button>
          </div>
        )}
      </header>

      <div className={`casa3d-grade${vistaTrocada ? ' is-trocado' : ''}`}>
        {/* Vista 3D da casa */}
        <div className="casa3d-vista" ref={vistaRef}>
          <div className="casa3d-canvas" ref={containerRef} aria-label="Vista 3D da casa. Arraste para girar, role para aproximar, toque no piso para enviar o robô." role="img" />
          {vistaTrocada && !sceneError && <span className="casa3d-tag is-escuro casa3d-tag-pip">Casa 3D</span>}
          {sceneError && (
            <div className="casa3d-falha" role="status">
              <span className="casa3d-falha-icone" aria-hidden="true"><Home size={22} /></span>
              <h2>A vista 3D não abriu neste aparelho</h2>
              <p>O navegador não liberou o WebGL. Os comandos ao lado continuam funcionando, e o Início mostra a planta da casa.</p>
            </div>
          )}
          {!sceneError && !vistaTrocada && <>
            <span className={`selo is-pequeno casa3d-selo ${seloVista.c}`}>{seloVista.t}</span>
            {!celular && (
              <div className="casa3d-zoom">
                <button className="btn-icone is-flutuante" onClick={() => sceneRef.current?.zoom(0.8)} aria-label="Aproximar" title="Aproximar"><Plus size={20} /></button>
                <button className="btn-icone is-flutuante" onClick={() => sceneRef.current?.zoom(1.25)} aria-label="Afastar" title="Afastar"><Minus size={20} /></button>
                <button className="btn-icone is-flutuante" onClick={() => sceneRef.current?.recentralizar()} aria-label="Recentralizar" title="Recentralizar"><RotateCcw size={20} /></button>
              </div>
            )}
            {celular && <>
              <button className="btn-icone is-flutuante casa3d-recentralizar" onClick={() => sceneRef.current?.recentralizar()} aria-label="Recentralizar" title="Recentralizar"><RotateCcw size={20} /></button>
              <button className="btn btn-escuro casa3d-ar" onClick={() => void enterAR()} disabled={!arSupported}
                title={arSupported ? 'Abrir em realidade aumentada' : 'Abra pelo Chrome no Android, via HTTPS'}><Glasses size={20} aria-hidden="true" />Ver em AR</button>
            </>}
            {!celular && online && !pendente && <p className="casa3d-dica"><MapPin size={16} aria-hidden="true" />Toque no piso para enviar o robô</p>}
          </>}
          {!online && robot && !sceneError && (
            <div className="casa3d-offline" role="status">
              <span className="casa3d-offline-icone" aria-hidden="true"><WifiOff size={22} /></span>
              <h2>{celular ? 'Sem sinal do robô' : 'Não estamos recebendo dados do robô'}</h2>
              {!celular && <p>Veja se ele está ligado e se o Wi-Fi da casa está funcionando. Os comandos que você mandar ficam na fila.</p>}
              <button className="btn btn-escuro" onClick={() => void reconectar()} disabled={reconectando}>
                {reconectando ? <span className="carregando is-claro" aria-hidden="true" /> : <RotateCcw size={18} aria-hidden="true" />}Tentar reconectar
              </button>
            </div>
          )}
        </div>

        {/* Pelos olhos do robô (miniatura no computador; painel próprio no celular) */}
        <div className={`casa3d-olhos${sceneError ? ' is-sem-video' : ''}`}>
          <div className="casa3d-olhos-cabecalho">
            <h2 className="titulo-painel">Pelos olhos do robô</h2>
            <span className="casa3d-tag is-escuro"><span className="ponto-vivo" aria-hidden="true" />Ao vivo</span>
          </div>
          <div className="casa3d-olhos-video" ref={eyesRef} role="img" aria-label="Câmera frontal do robô">
            <div className="casa3d-olhos-tags">
              <span className="casa3d-tag is-escuro casa3d-olhos-rotulo"><span className="ponto-vivo" aria-hidden="true" />Ao vivo · câmera do robô</span>
              {socorro && emergency && (
                <span className="casa3d-tag is-perigo">
                  {emergency.alertType === 'FALL_DETECTED' ? 'Queda' : 'Socorro'}{ondePessoa ? ` ${naNo(ondePessoa)}` : ''} · {haQuanto(emergency.createdAt)}
                </span>
              )}
            </div>
          </div>
          {!celular && !sceneError && (
            <button className="btn-icone is-flutuante casa3d-trocar" onClick={() => setTrocado(!vistaTrocada)}
              aria-label={vistaTrocada ? 'Mostrar a casa 3D grande' : 'Mostrar a câmera do robô grande'} title="Trocar vistas">
              <ArrowLeftRight size={18} />
            </button>
          )}
        </div>

        {/* Camadas */}
        {!sceneError && (
          <div className="casa3d-camadas" role="group" aria-label="Camadas da vista">
            {!celular && <Layers size={20} aria-hidden="true" className="casa3d-camadas-icone" />}
            <div className={celular ? 'fila-rolavel' : 'casa3d-camadas-lista'}>
              {CAMADAS.map(c => (
                <label key={c.id} className={`toggle-camada${camadas[c.id] ? ' is-ativo' : ''}`}>
                  <input type="checkbox" checked={camadas[c.id]} onChange={e => setCamadas(v => ({ ...v, [c.id]: e.target.checked }))} />
                  <span className="toggle-camada-caixa" aria-hidden="true" />
                  {c.rotulo}
                </label>
              ))}
            </div>
          </div>
        )}
        {celular && <p className="casa3d-dica-celular texto-pequeno">Arraste para girar · pinça para aproximar · toque no piso para mandar o robô</p>}

        {/* Confirmar destino */}
        {pendente && (
          <div className="casa3d-confirmar" role="dialog" aria-labelledby="confirmar-titulo">
            <div>
              <p id="confirmar-titulo" className="casa3d-confirmar-titulo">
                {pendingRoom ? `Enviar o robô para ${artigo(comodoCurto(layout, pendingRoom.id) ?? pendingRoom.name)}?` : 'Esse ponto fica fora da casa'}
              </p>
              <p className="casa3d-confirmar-detalhe">
                {pendingRoom
                  ? distPendente != null ? `${metros(distPendente)} da posição atual · ${chegada(distPendente)}` : `${pendente.ponto.x.toFixed(1)} m, ${pendente.ponto.y.toFixed(1)} m`
                  : 'Escolha um ponto dentro da planta.'}
              </p>
            </div>
            <div className="casa3d-confirmar-botoes">
              <button className="btn btn-fantasma is-cinza" onClick={() => setPendente(null)}>Cancelar</button>
              <button className="btn btn-primario" disabled={busy || !pendingRoom || bloqueado} onClick={enviarPendente} data-autofoco>Enviar robô</button>
            </div>
          </div>
        )}

        {/* Comandar o robô */}
        <aside className={`painel casa3d-comandar${celular && passos && !socorro ? ' tem-missao' : ''}`} aria-labelledby="titulo-comandar">
          <div className="casa3d-comandar-cabecalho">
            <h2 id="titulo-comandar" className="titulo-painel">{celular ? 'Mandar o robô para' : 'Comandar o robô'}</h2>
            {!celular && <p className="texto-pequeno">Escolha um cômodo ou toque no piso da casa</p>}
          </div>
          {bloqueado && <p className="nota is-perigo"><Lock size={16} aria-hidden="true" />Comandos bloqueados enquanto o robô atende o socorro.</p>}
          {!bloqueado && !online && robot && <p className="nota is-aviso"><WifiOff size={16} aria-hidden="true" />O robô está fora do ar. O que você mandar fica guardado e sai quando ele voltar.</p>}
          {!celular && <p className="rotulo-secao">Para onde?</p>}
          <div className="casa3d-comodos">
            {layout.rooms.map(room => {
              const selecionado = (mission?.targetRoom === room.id && mission.type !== 'PATROL') || pendente?.room?.id === room.id;
              return (
                <button key={room.id} className={`chip-comodo${selecionado ? ' is-selecionado' : ''}`} disabled={busy || bloqueado}
                  aria-pressed={selecionado}
                  onMouseEnter={() => setHoverRoom(room.id)} onMouseLeave={() => setHoverRoom(null)}
                  onFocus={() => setHoverRoom(room.id)} onBlur={() => setHoverRoom(null)}
                  onClick={() => { setPendente({ ponto: { x: room.targetX, y: room.targetY }, room }); setFeedback(null); }}>
                  <span className="chip-comodo-nome">{celular && room.id === 'sala' ? 'Sala' : room.name}</span>
                  <span className="chip-comodo-status">{statusComodo(room)}</span>
                </button>
              );
            })}
          </div>
          {bloqueado ? (
            <div className="casa3d-acoes">
              {demo
                ? <span className="btn btn-perigo" aria-disabled="true" title="Simulação: nenhuma ligação é feita no modo demonstração"><Phone size={20} aria-hidden="true" />Ligar SAMU 192</span>
                : <a className="btn btn-perigo" href="tel:192"><Phone size={20} aria-hidden="true" />Ligar SAMU 192</a>}
              <a className="btn btn-secundario" href={`tel:${telefonePessoa}`}><Phone size={20} aria-hidden="true" />Ligar para {pessoa}</a>
            </div>
          ) : (
            <div className="casa3d-acoes">
              <button className="btn btn-secundario" disabled={busy} onClick={() => void send({ type: 'PATROL' }, 'Patrulha iniciada.')}><Route size={20} aria-hidden="true" />Patrulhar</button>
              <button className="btn btn-secundario" disabled={busy} onClick={() => void send({ type: 'RETURN_TO_DOCK' }, 'Robô voltando para a base.')}><Home size={20} aria-hidden="true" />Voltar à base</button>
            </div>
          )}

          {feedback && <p className={`nota ${feedback.error ? 'is-perigo' : 'is-sucesso'} casa3d-feedback`} role="status">{feedback.text}</p>}

          <hr className="casa3d-divisor" />
          <div className="casa3d-missao">
            <p className="rotulo-secao">{socorro ? 'Socorro em andamento' : celular && passos ? `Missão: ${mission?.type === 'RETURN_TO_DOCK' ? 'voltar à base' : `ir até ${destinoMissao ? artigo(destinoMissao) : 'o ponto'}`}` : 'Missão atual'}</p>
            {passos
              ? <PassosMissao passos={passos} rotulo={socorro ? 'Etapas do socorro' : 'Etapas da missão'} />
              : <p className="texto-pequeno">{!online && robot ? 'Nenhuma missão em andamento. Comandos novos ficam na fila.' : mission?.type === 'PATROL' ? 'Fazendo a ronda pelos cômodos. Ele responde sozinho se a bengala avisar.' : 'Sem missão agora. O robô faz a ronda e responde sozinho se a bengala avisar.'}</p>}
            {mission && !socorro && mission.type !== 'PATROL' && (
              <button className="btn btn-perigo-suave btn-bloco" onClick={() => void cancelCurrent()} disabled={busy}><X size={18} aria-hidden="true" />Cancelar missão</button>
            )}
          </div>

          <div className="casa3d-historico">
            <button className="btn-link" onClick={() => setHistorico(v => !v)} aria-expanded={historico}>
              {historico ? 'Esconder histórico de missões' : 'Ver histórico de missões'}<ArrowRight size={16} aria-hidden="true" />
            </button>
            {historico && (missions.length === 0 ? <p className="texto-pequeno">Nenhuma missão registrada.</p> : (
              <ol className="casa3d-missoes">
                {missions.map(m => (
                  <li key={m.id}>
                    <span className={`selo is-pequeno is-sem-ponto status-${m.status.toLowerCase()}`}>{STATUS_LABEL[m.status]}</span>
                    <span><strong>{MISSION_LABEL[m.type]}</strong>{m.targetRoom ? ` · ${findRoom(layout, m.targetRoom)?.name ?? m.targetRoom}` : ''}</span>
                    <small>{horaCurta(m.createdAt)}{m.resultMessage ? ` · ${m.resultMessage}` : ''}</small>
                  </li>
                ))}
              </ol>
            ))}
          </div>
        </aside>

        {/* Estado e sensores (celular e tablet) */}
        <section className="painel casa3d-sensores" aria-labelledby="titulo-sensores">
          <h2 id="titulo-sensores" className="titulo-painel">Estado e sensores</h2>
          <dl>
            <div><dt>Modo</dt><dd>{robot ? (online ? MODE_LABEL[robot.mode] : 'Desconhecido') : '—'}</dd></div>
            <div><dt>Cômodo</dt><dd>{roomName(layout, robot?.currentRoom)}</dd></div>
            <div><dt>Obstáculo mais perto</dt><dd>{online && robot?.nearestObstacleM != null ? metros(robot.nearestObstacleM) : '—'}</dd></div>
            <div><dt>Posição no mapa</dt><dd>{robot ? `${robot.x.toFixed(2).replace('.', ',')} · ${robot.y.toFixed(2).replace('.', ',')}` : '—'}</dd></div>
          </dl>
        </section>
      </div>

      <div className="casa3d-ar-overlay" ref={overlayRef} hidden={!inAR}>
        <p>{robot ? `${MODE_LABEL[robot.mode]} · ${roomName(layout, robot.currentRoom)}` : 'Conectando…'}</p>
        <p className="texto-pequeno">Toque na maquete para enviar o robô</p>
        <button className="btn btn-secundario" onClick={() => { sceneRef.current?.exitAR(); setInAR(false); }}>Sair do AR</button>
      </div>
    </section>
  );
};
