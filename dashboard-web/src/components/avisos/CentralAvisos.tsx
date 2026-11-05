import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DESLOCA, DUR, EASE_MOTION, QUEDA } from '../../motion/tokens';
import { Battery, Bot, Camera, Check, Copy, Footprints, MapPin, Pill, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';
import type { Alert, AlertType } from '../../types';
import type { HouseLayout } from '../../types/robot';
import { useAvisosVistos } from '../../lib/vistos';
import { categoriaAviso, ehHoje, ehOntem, horaCurta, limparTexto, tituloAviso, tomAviso, type CategoriaAviso } from '../../lib/avisos';

interface CentralAvisosProps {
  alerts: Alert[];
  layout: HouseLayout;
  onResolver: (id: number) => void;
  onVerNoMapa: () => void;
}

type Filtro = 'todos' | CategoriaAviso;
const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' }, { id: 'bengala', rotulo: 'Bengala' }, { id: 'robo', rotulo: 'Robô' }, { id: 'camera', rotulo: 'Câmera' }
];

const ICONE: Partial<Record<AlertType, LucideIcon>> = {
  CHECKIN_SAFE: Check,
  POTHOLE_HOLE_DETECTED: Footprints,
  LOW_BATTERY: Battery,
  DEVICE_OFFLINE: WifiOff,
  MEDICATION_REMINDER: Pill,
  GEOFENCE_EXIT: MapPin,
  HAND_GESTURE_SOS: Camera,
  SUSPICIOUS_PERSON_DETECTED: Camera,
  ROBOT_ARRIVED: Bot,
  ROBOT_MISSION_FAILED: Bot,
  AGENT_RECOMMENDATION: Bot
};


/** Central de avisos (Figma 30:1556 e 36:2865): popover no computador, folha inferior no celular. */
export const CentralAvisos: React.FC<CentralAvisosProps> = ({ alerts, layout, onResolver, onVerNoMapa }) => {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const vistos = useAvisosVistos();
  const [tudo, setTudo] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);

  const pendentes = alerts.filter(a => a.status === 'PENDING');
  const filtrados = useMemo(() => alerts
    .filter(a => filtro === 'todos' || categoriaAviso(a) === filtro)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [alerts, filtro]);
  const visiveis = tudo ? filtrados : filtrados.slice(0, 8);
  const grupos = [
    { titulo: 'Hoje', itens: visiveis.filter(a => ehHoje(a.createdAt)) },
    { titulo: 'Ontem', itens: visiveis.filter(a => ehOntem(a.createdAt)) },
    { titulo: 'Antes', itens: visiveis.filter(a => !ehHoje(a.createdAt) && !ehOntem(a.createdAt)) }
  ].filter(g => g.itens.length);


  const copiar = (a: Alert) => {
    if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) return;
    void navigator.clipboard?.writeText(`${a.latitude.toFixed(6)}, ${a.longitude.toFixed(6)}`);
    setCopiado(a.id);
    window.setTimeout(() => setCopiado(null), 2000);
  };

  const criticos = pendentes.filter(a => a.severity === 'CRITICAL').length;
  let ordemNaoLido = 0;

  return (
    <div className="avisos">
      <div className="avisos-topo">
        <p className={`nota com-ponto ${pendentes.length === 0 ? 'is-sucesso' : criticos ? 'is-perigo' : 'is-aviso'}`} role="status">
          {pendentes.length === 0 ? 'Nada precisa de você agora'
            : criticos ? `${criticos === 1 ? 'Um pedido de socorro espera' : `${criticos} pedidos de socorro esperam`} sua resposta`
              : `${pendentes.length === 1 ? 'Um aviso espera' : `${pendentes.length} avisos esperam`} sua resposta`}
        </p>
        <div className="segmento avisos-filtros" role="group" aria-label="Filtrar avisos">
          {FILTROS.map(f => (
            <button key={f.id} aria-pressed={filtro === f.id} className={filtro === f.id ? 'is-ativo' : ''} onClick={() => setFiltro(f.id)}>{f.rotulo}</button>
          ))}
        </div>
      </div>

      <div className="avisos-lista">
        {grupos.length === 0 && <p className="avisos-vazio texto-secundario">Nenhum aviso {filtro === 'todos' ? 'por enquanto' : 'nesta categoria'}.</p>}
        {grupos.map(g => (
          <section key={g.titulo} aria-label={g.titulo}>
            <h3 className="rotulo-secao avisos-grupo">{g.titulo}</h3>
            <ul>
              <AnimatePresence initial={false}>
              {g.itens.map(a => {
                const tom = tomAviso(a);
                const Icone = ICONE[a.alertType] ?? TriangleAlert;
                const naoLido = !vistos.has(a.id) && (a.status === 'PENDING' || Date.now() - new Date(a.createdAt).getTime() < 3600_000);
                const temPosicao = Number.isFinite(a.latitude) && Number.isFinite(a.longitude);
                const ordem = naoLido ? ordemNaoLido++ : 0;
                return (
                  // Aviso novo entra no topo da lista (240 ms, desliza 8 px)
                  <motion.li key={a.id} className={`aviso is-${tom}${a.status === 'PENDING' ? ' is-pendente' : ''}`}
                    initial={{ opacity: 0, y: -DESLOCA }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: QUEDA.duracaoEvento, ease: EASE_MOTION }}>
                    <span className="aviso-icone" aria-hidden="true"><Icone size={18} /></span>
                    <div className="aviso-corpo">
                      <div className="aviso-linha">
                        <strong>{tituloAviso(a, layout)}</strong>
                        <span className="aviso-hora">{ehHoje(a.createdAt) || ehOntem(a.createdAt) ? horaCurta(a.createdAt) : new Date(a.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                        {/* "Marcar como vistos": os pontos azuis apagam um depois do outro */}
                        <AnimatePresence initial={false}>
                          {naoLido && <motion.span key="ponto" className="aviso-nao-lido" aria-label="não visto"
                            exit={{ opacity: 0, scale: 0.4, transition: { duration: DUR.curta, ease: EASE_MOTION, delay: ordem * 0.05 } }} />}
                        </AnimatePresence>
                      </div>
                      <p>{limparTexto(a.message)}{a.status === 'RESOLVED' && a.resolvedAt ? ` · resolvido às ${horaCurta(a.resolvedAt)}` : ''}</p>
                      <div className="aviso-acoes">
                        {temPosicao && <button className="btn-link" onClick={onVerNoMapa}><MapPin size={16} aria-hidden="true" />Ver no mapa</button>}
                        {temPosicao && <button className="btn-link" onClick={() => copiar(a)}>
                          {copiado === a.id ? <><Check size={16} aria-hidden="true" />Copiado</> : <><Copy size={16} aria-hidden="true" />Copiar posição</>}
                        </button>}
                        {a.status === 'PENDING' && <button className="btn-link is-forte" onClick={() => onResolver(a.id)}>Marcar como resolvido</button>}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>

      {filtrados.length > 8 && (
        <div className="avisos-rodape">
          <button className="btn-link" onClick={() => setTudo(v => !v)} aria-expanded={tudo}>{tudo ? 'Mostrar só os recentes' : 'Ver histórico completo'}</button>
        </div>
      )}
    </div>
  );
};
