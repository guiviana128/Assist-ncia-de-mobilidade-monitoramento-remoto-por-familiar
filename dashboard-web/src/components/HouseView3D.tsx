import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Glasses, Home, MapPin, Navigation, Radar, Route, ShieldAlert, Square, X } from 'lucide-react';
import type { Alert } from '../types';
import type { HouseLayout, MissionRequest, Point2D, RobotMission, RobotState } from '../types/robot';
import { HouseScene } from './house3d/HouseScene';
import { FALLBACK_LAYOUT, findRoom, planPath, roomAt, roomName } from '../robot/houseLayout';
import { robotApi } from '../services/robotApi';
import { ApiError, AuthRequiredError } from '../services/auth';

interface HouseView3DProps {
  alerts: Alert[];
  isDarkMode: boolean;
}

const EMERGENCY_TYPES: Alert['alertType'][] = ['SOS_BUTTON', 'FALL_DETECTED', 'HAND_GESTURE_SOS'];

const MODE_LABEL: Record<RobotState['mode'], string> = {
  IDLE: 'Parado',
  PATROLLING: 'Patrulhando',
  RESPONDING: 'Atendendo socorro',
  CHECKING_PERSON: 'Verificando a pessoa',
  GOING_TO_GOAL: 'Indo ao destino',
  RETURNING: 'Voltando à base',
  OFFLINE: 'Offline'
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

const errorMessage = (error: unknown) =>
  error instanceof ApiError || error instanceof Error ? error.message : 'Não foi possível enviar o comando.';

export const HouseView3D: React.FC<HouseView3DProps> = ({ alerts, isDarkMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HouseScene | null>(null);

  const [layout, setLayout] = useState<HouseLayout>(FALLBACK_LAYOUT);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [missions, setMissions] = useState<RobotMission[]>([]);
  const [pendingPoint, setPendingPoint] = useState<Point2D | null>(null);
  const [hoverRoom, setHoverRoom] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [inAR, setInAR] = useState(false);
  const [sceneError, setSceneError] = useState('');

  const emergency = useMemo(
    () => alerts.find(a => a.status === 'PENDING' && EMERGENCY_TYPES.includes(a.alertType)),
    [alerts]
  );

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

  useEffect(() => {
    let active = true;
    const pollState = async () => {
      try {
        const state = await robotApi.getState();
        if (active) setRobot(state);
      } catch { /* App trata AuthRequiredError; outras falhas: tenta de novo no próximo ciclo */ }
    };
    void pollState();
    void refreshMissions();
    const stateTimer = window.setInterval(pollState, 1000);
    const missionTimer = window.setInterval(() => void refreshMissions(), 3000);
    return () => { active = false; window.clearInterval(stateTimer); window.clearInterval(missionTimer); };
  }, [refreshMissions]);

  // ---------------------------------------------------------------- cena 3D
  const handleFloorClick = useCallback((point: Point2D) => {
    setPendingPoint(point);
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !eyesRef.current) return;
    try {
      const scene = new HouseScene({
        container: containerRef.current,
        eyesContainer: eyesRef.current,
        layout,
        dark: isDarkMode,
        onFloorClick: point => handleFloorClick(point),
        onARChange: setInAR
      });
      sceneRef.current = scene;
      setSceneError('');
      return () => { scene.dispose(); sceneRef.current = null; };
    } catch (error) {
      setSceneError(`Não foi possível iniciar o 3D (WebGL): ${errorMessage(error)}`);
      return undefined;
    }
    // isDarkMode é aplicado no efeito abaixo; recriar a cena só quando a planta mudar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, handleFloorClick]);

  useEffect(() => { sceneRef.current?.setDark(isDarkMode); }, [isDarkMode]);
  useEffect(() => { sceneRef.current?.setPendingPoint(pendingPoint); }, [pendingPoint]);
  useEffect(() => { sceneRef.current?.setHighlightRoom(hoverRoom); }, [hoverRoom]);

  const personRoom = emergency?.indoorRoom ?? robot?.personRoom ?? null;
  const mission = robot?.currentMission ?? null;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !robot) return;
    scene.setRobot(robot);
    scene.setPerson({ roomId: personRoom, emergency: !!emergency, fallen: emergency?.alertType === 'FALL_DETECTED' });
    if (mission?.targetX != null && mission.targetY != null) {
      const goal = { x: mission.targetX, y: mission.targetY };
      scene.setGoal(goal, planPath(layout, robot, goal), mission.type === 'RESPOND_TO_ALERT' ? '#ef4444' : '#3b82f6');
    } else {
      scene.setGoal(null, []);
    }
  }, [robot, emergency, personRoom, mission, layout]);

  // ---------------------------------------------------------------- comandos
  const send = async (request: MissionRequest, success: string) => {
    setBusy(true);
    try {
      const created = await robotApi.requestMission(request);
      setFeedback(created.status === 'CANCELLED'
        ? { text: created.resultMessage ?? 'O robô não aceitou o comando agora.', error: true }
        : { text: success });
      setPendingPoint(null);
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
      setFeedback({ text: 'Missão cancelada. O robô volta ao comportamento padrão.' });
      void refreshMissions();
    } catch (error) {
      if (!(error instanceof AuthRequiredError)) setFeedback({ text: errorMessage(error), error: true });
    } finally {
      setBusy(false);
    }
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

  const pendingRoom = pendingPoint ? roomAt(layout, pendingPoint) : undefined;
  const online = !!robot?.online;
  const isDemo = robotApi.isDemo();

  return (
    <section className="house3d" aria-label="Casa inteligente em 3D">
      <div className="house3d-main glass-panel">
        <div className="house3d-toolbar">
          <div>
            <h3><Home size={18} /> {layout.name}</h3>
            <p className="muted">Arraste para girar · role para aproximar · clique no piso para enviar o robô</p>
          </div>
          <div className="house3d-toolbar-actions">
            <span className={`badge ${online ? 'badge-online' : 'badge-warning'}`}>
              {isDemo ? 'Robô simulado (demonstração)' : online ? 'Robô conectado (ROS 2)' : 'Robô offline'}
            </span>
            <button className="btn btn-secondary" onClick={() => void enterAR()} disabled={!arSupported}
              title={arSupported ? 'Abrir a maquete da casa em Realidade Aumentada' : 'Abra pelo Chrome no Android, via HTTPS (npm run dev:https)'}>
              <Glasses size={17} /> Ver em AR
            </button>
          </div>
        </div>

        <div className="house3d-canvas" ref={containerRef}>
          {sceneError && <div className="empty-state">{sceneError}</div>}
          {emergency && (
            <div className="house3d-alert" role="alert">
              <ShieldAlert size={18} />
              <span>{emergency.alertType === 'FALL_DETECTED' ? 'Queda' : 'Socorro'} em <strong>{roomName(layout, personRoom)}</strong> · {mission?.type === 'RESPOND_TO_ALERT' ? 'robô a caminho' : robot?.mode === 'CHECKING_PERSON' ? 'robô ao lado da pessoa' : 'aguardando robô'}</span>
            </div>
          )}
          <ul className="house3d-legend" aria-label="Legenda">
            <li><i style={{ background: '#22c55e' }} />Patrulha</li>
            <li><i style={{ background: '#ef4444' }} />Socorro</li>
            <li><i style={{ background: '#3b82f6' }} />Comando</li>
            <li><i style={{ background: '#22d3ee' }} />LiDAR</li>
          </ul>
        </div>

        {pendingPoint && (
          <div className="house3d-confirm">
            <MapPin size={18} />
            <span>Enviar o robô para <strong>{pendingRoom?.name ?? 'fora da casa'}</strong> ({pendingPoint.x.toFixed(1)} m, {pendingPoint.y.toFixed(1)} m)?</span>
            <button className="btn btn-primary" disabled={busy || !pendingRoom}
              onClick={() => void send({ type: 'GO_TO_POINT', targetX: Number(pendingPoint.x.toFixed(2)), targetY: Number(pendingPoint.y.toFixed(2)), reason: 'Ponto escolhido na planta 3D' }, 'Robô a caminho do ponto escolhido.')}>
              Enviar
            </button>
            <button className="btn btn-secondary" onClick={() => setPendingPoint(null)} aria-label="Cancelar"><X size={16} /></button>
          </div>
        )}
        {feedback && <p className={feedback.error ? 'feedback-error' : 'house3d-feedback'} role="status">{feedback.text}</p>}
      </div>

      <aside className="house3d-side">
        <div className="glass-panel house3d-card">
          <h3><Bot size={18} /> Pelos olhos do robô</h3>
          <div className="house3d-eyes" ref={eyesRef}>
            <span className="house3d-eyes-tag">● AO VIVO · câmera frontal</span>
          </div>
        </div>

        <div className="glass-panel house3d-card">
          <h3><Radar size={18} /> Estado e sensores</h3>
          <dl className="house3d-stats">
            <div><dt>Modo</dt><dd>{robot ? MODE_LABEL[robot.mode] : '—'}</dd></div>
            <div><dt>Cômodo</dt><dd>{roomName(layout, robot?.currentRoom)}</dd></div>
            <div><dt>Obstáculo mais próximo</dt><dd>{robot?.nearestObstacleM != null ? `${robot.nearestObstacleM.toFixed(2)} m` : '—'}</dd></div>
            <div><dt>Posição (mapa)</dt><dd>{robot ? `${robot.x.toFixed(2)}, ${robot.y.toFixed(2)}` : '—'}</dd></div>
          </dl>
          <p className="muted">{robot?.navStatus ?? 'Aguardando dados do robô…'}</p>
          {mission && (
            <div className={`house3d-mission ${mission.type === 'RESPOND_TO_ALERT' ? 'is-emergency' : ''}`}>
              <Route size={16} />
              <span><strong>{MISSION_LABEL[mission.type]}</strong> · {mission.reason}</span>
              <button className="btn btn-secondary" onClick={() => void cancelCurrent()} disabled={busy}><Square size={14} /> Cancelar</button>
            </div>
          )}
        </div>

        <div className="glass-panel house3d-card">
          <h3><Navigation size={18} /> Comandar o robô</h3>
          <div className="house3d-rooms">
            {layout.rooms.map(room => (
              <button key={room.id} className="btn btn-secondary" disabled={busy}
                onMouseEnter={() => setHoverRoom(room.id)} onMouseLeave={() => setHoverRoom(null)}
                onFocus={() => setHoverRoom(room.id)} onBlur={() => setHoverRoom(null)}
                onClick={() => void send({ type: 'GO_TO_ROOM', targetRoom: room.id }, `Robô a caminho: ${room.name}.`)}>
                {room.name}
              </button>
            ))}
          </div>
          <div className="house3d-actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => void send({ type: 'PATROL' }, 'Patrulha iniciada.')}>Patrulhar</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => void send({ type: 'RETURN_TO_DOCK' }, 'Robô voltando para a base.')}>Voltar à base</button>
          </div>
        </div>

        <div className="glass-panel house3d-card">
          <h3>Últimas missões</h3>
          {missions.length === 0 ? <p className="muted">Nenhuma missão registrada.</p> : (
            <ol className="house3d-missions">
              {missions.map(m => (
                <li key={m.id}>
                  <span className={`house3d-status status-${m.status.toLowerCase()}`}>{STATUS_LABEL[m.status]}</span>
                  <span><strong>{MISSION_LABEL[m.type]}</strong>{m.targetRoom ? ` · ${findRoom(layout, m.targetRoom)?.name ?? m.targetRoom}` : ''}</span>
                  <small>{new Date(m.createdAt).toLocaleTimeString('pt-BR')}{m.resultMessage ? ` · ${m.resultMessage}` : ''}</small>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>

      <div className="house3d-ar-overlay" ref={overlayRef} hidden={!inAR}>
        <p>{robot ? `${MODE_LABEL[robot.mode]} · ${roomName(layout, robot.currentRoom)}` : 'Conectando…'}</p>
        <p className="muted">Toque na maquete para enviar o robô</p>
        <button className="btn btn-secondary" onClick={() => { sceneRef.current?.exitAR(); setInAR(false); }}>Sair do AR</button>
      </div>
    </section>
  );
};
