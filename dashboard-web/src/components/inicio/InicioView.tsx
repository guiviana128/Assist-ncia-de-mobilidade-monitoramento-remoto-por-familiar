import React, { useMemo, useState } from 'react';
import { ArrowRight, Battery, Box, DoorOpen, Footprints, Phone, Pill } from 'lucide-react';
import type { Alert, DeviceStatus } from '../../types';
import type { HouseLayout, Point2D, RobotMission, RobotState, Room } from '../../types/robot';
import { planPath } from '../../robot/houseLayout';
import { FraseEstado } from '../ui/FraseEstado';
import { Fato, ItemLinhaDoTempo } from '../ui/LinhaDoTempo';
import { PlantaCasa, PlantaSimplificada, type EstadoComodo } from '../planta/PlantaCasa';
import { descricaoRobo, emergenciaPendente, haQuanto, nomePessoa, type Resumo } from '../../lib/resumoDoEstado';
import { ehHoje, horaCurta, itemDeAviso, itemDeMissao, type ItemDia } from '../../lib/avisos';
import { proximoRemedio, useCuidado } from '../../lib/cuidado';
import { ATE_TABLET, CELULAR, useMediaQuery } from '../../hooks/useMediaQuery';

interface InicioViewProps {
  device: DeviceStatus;
  alerts: Alert[];
  layout: HouseLayout;
  robot: RobotState | null;
  missions: RobotMission[];
  noComodoDesde: number | null;
  resumo: Resumo;
  demo: boolean;
  onAbrirCasa: (roomId?: string) => void;
  onResolver: (alertId: number) => void;
}

const dataLonga = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', '');
const dataCurta = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', ',');

function textoBateria(p: number) {
  const pct = `${Math.round(p)}%`;
  if (p <= 15) return `${pct} · carregue agora`;
  if (p <= 35) return `${pct} · carregue hoje à noite`;
  return `${pct} · carga boa para hoje`;
}

/** Tela Início (Figma 1:2, 14:635, 34:2283, 34:2466, 36:3357). */
export const InicioView: React.FC<InicioViewProps> = ({ device, alerts, layout, robot, missions, noComodoDesde, resumo, demo, onAbrirCasa, onResolver }) => {
  const celular = useMediaQuery(CELULAR);
  const ateTablet = useMediaQuery(ATE_TABLET);
  const { remedios, telefonePessoa } = useCuidado();
  const [diaTodo, setDiaTodo] = useState(false);
  const emergencia = emergenciaPendente(alerts);
  const pessoa = nomePessoa(device);
  const agora = new Date();

  // ---- onde estão José e o robô
  const comodoPessoa = emergencia?.indoorRoom ?? robot?.personRoom ?? null;
  const roboOnline = !!robot && robot.online && robot.mode !== 'OFFLINE';
  const posRobo: Point2D | null = robot ? { x: robot.x, y: robot.y } : null;
  const destino: Point2D | null = robot?.currentMission?.targetX != null && robot.currentMission.targetY != null
    ? { x: robot.currentMission.targetX, y: robot.currentMission.targetY } : null;
  const rota = posRobo && destino && roboOnline ? planPath(layout, posRobo, destino) : undefined;
  const comodoRobo = robot?.currentRoom ?? null;

  const estados = useMemo(() => {
    const e: Record<string, EstadoComodo> = {};
    for (const room of layout.rooms) e[room.id] = { titulo: celular || ateTablet ? (room.id === 'sala' ? 'Vazia' : 'Vazio') : 'Vazio' };
    if (comodoRobo && e[comodoRobo]) e[comodoRobo] = { titulo: roboOnline ? (celular || ateTablet ? 'Robô na ronda' : descricaoRobo(robot, layout).replace(/^r/, 'R')) : 'Robô fora do ar' };
    if (comodoPessoa && e[comodoPessoa]) {
      e[comodoPessoa] = emergencia
        ? { titulo: celular || ateTablet ? `${pessoa} caiu aqui` : `Queda detectada · ${haQuanto(emergencia.createdAt)}`, tom: 'perigo' }
        : { titulo: `${pessoa} está aqui${noComodoDesde && !(celular || ateTablet) ? ` · ${haQuanto(noComodoDesde)}` : ''}`, tom: 'pessoa' };
      if (emergencia?.alertType !== 'FALL_DETECTED' && emergencia) e[comodoPessoa] = { titulo: `${pessoa} pediu ajuda aqui`, tom: 'perigo' };
    }
    return e;
  }, [layout, comodoPessoa, comodoRobo, emergencia, robot, roboOnline, noComodoDesde, pessoa, celular, ateTablet]);

  // ---- linha do tempo do dia (alertas + missões do robô)
  const itens: ItemDia[] = useMemo(() => {
    const deAvisos = alerts.filter(a => ehHoje(a.createdAt)).map(a => itemDeAviso(a, layout));
    const deMissoes = missions.filter(m => ehHoje(m.finishedAt ?? m.createdAt))
      .map(m => itemDeMissao(m, layout)).filter((i): i is ItemDia => !!i);
    return [...deAvisos, ...deMissoes].sort((a, b) => b.quando - a.quando);
  }, [alerts, missions, layout]);
  const limite = diaTodo ? itens.length : emergencia ? (celular ? 3 : 6) : celular || ateTablet ? 3 : 5;
  const visiveis = itens.slice(0, limite);
  const hhmm = horaCurta(agora);
  const maisTarde = remedios.filter(r => r.ativo && r.hora > hhmm).slice(0, celular || ateTablet ? 0 : 2);

  // ---- fatos
  const prox = proximoRemedio(remedios, agora);
  const saida = alerts.find(a => a.alertType === 'GEOFENCE_EXIT');
  const fatos = [
    { Icone: Battery, rotulo: 'Bengala', valor: textoBateria(device.batteryPercent) },
    { Icone: Pill, rotulo: 'Próximo remédio', valor: prox ? `${prox.amanha ? 'Amanhã, ' : ''}${prox.remedio.hora} · ${prox.remedio.nome.toLowerCase()}` : 'Nenhum lembrete' },
    { Icone: Footprints, rotulo: 'Caminhada hoje', valor: device.stepsToday != null ? `${device.stepsToday.toLocaleString('pt-BR')} passos${device.activeMinutes ? ` · ${device.activeMinutes} min ativo` : ''}` : 'Sem dados hoje' },
    { Icone: DoorOpen, rotulo: 'Última saída', valor: saida ? `${ehHoje(saida.createdAt) ? 'Hoje' : new Date(saida.createdAt).toLocaleDateString('pt-BR')}, ${horaCurta(saida.createdAt)}` : 'Nenhuma saída registrada' }
  ];

  const abrirComodo = (room: Room) => onAbrirCasa(room.id);
  const ligarPessoa = <a className={`btn ${emergencia ? (celular ? 'btn-escuro' : 'btn-secundario') : 'btn-secundario'}`} href={`tel:${telefonePessoa}`}>
    <Phone size={20} aria-hidden="true" />{celular && !emergencia ? 'Ligar' : `Ligar para ${pessoa}`}
  </a>;

  const acoes = emergencia ? (celular ? <>
    {ligarPessoa}
    {demo
      ? <span className="btn btn-perigo" aria-disabled="true" title="Simulação: nenhuma ligação é feita no modo demonstração"><Phone size={20} aria-hidden="true" />Ligar 192 · SAMU</span>
      : <a className="btn btn-perigo" href="tel:192"><Phone size={20} aria-hidden="true" />Ligar 192 · SAMU</a>}
    <button className="btn btn-secundario" onClick={() => onAbrirCasa(emergencia.indoorRoom ?? undefined)}><Box size={20} aria-hidden="true" />Ver na Casa 3D</button>
  </> : <>
    {ligarPessoa}
    <button className="btn btn-escuro" onClick={() => onResolver(emergencia.id)}>Já estou cuidando<ArrowRight size={20} aria-hidden="true" /></button>
  </>) : <>
    {ligarPessoa}
    <button className="btn btn-primario" onClick={() => onAbrirCasa()}>
      {celular || ateTablet ? <><ArrowRight size={20} aria-hidden="true" />Abrir Casa 3D</> : <>Abrir Casa 3D<ArrowRight size={20} aria-hidden="true" /></>}
    </button>
  </>;

  // No celular/tablet o selo de conexão já está no topo: a linha de apoio não repete
  const detalheCurto = resumo.detalhe.split('  ·  ').filter(p => !/^Bengala conectada|^Modo demonstração|^Sem sinal/.test(p)).join(' · ');
  const detalhe = celular || ateTablet ? detalheCurto.charAt(0).toUpperCase() + detalheCurto.slice(1) : resumo.detalhe;

  return (
    <div className={`inicio${emergencia ? ' is-emergencia' : ''}`}>
      <FraseEstado tom={resumo.tom} forte={resumo.forte} apoio={resumo.apoio} detalhe={detalhe}
        indicador acoes={<div className={`inicio-acoes${emergencia && celular ? ' is-empilhado' : ''}`}>{acoes}</div>} />

      <div className="inicio-principal">
        <section className="painel inicio-casa" aria-labelledby="titulo-casa">
          <div className="painel-cabecalho">
            <h2 id="titulo-casa" className="titulo-painel">{emergencia && celular ? 'Onde ele está' : 'Casa agora'}</h2>
            {!ateTablet && (
              <ul className="legenda" aria-label="Legenda">
                <li><span className="legenda-pessoa" aria-hidden="true" />{pessoa}</li>
                <li><span className="legenda-robo" aria-hidden="true" />Robô</li>
                <li><span className={`legenda-rota${emergencia ? ' is-perigo' : ''}`} aria-hidden="true" />Rota do robô</li>
              </ul>
            )}
            {!(emergencia && celular) && <p className="texto-pequeno inicio-dica">{ateTablet ? 'Toque num cômodo' : 'Toque num cômodo para abrir na Casa 3D'}</p>}
          </div>
          <div className="inicio-mapa">
            {ateTablet
              ? <PlantaSimplificada layout={layout} comodoPessoa={comodoPessoa} comodoRobo={roboOnline ? comodoRobo : null}
                  emergencia={!!emergencia} estados={estados} onComodo={abrirComodo} />
              : <PlantaCasa layout={layout} comodoPessoa={comodoPessoa} robo={roboOnline ? posRobo : null} rota={rota}
                  emergencia={!!emergencia} estados={estados} onComodo={abrirComodo} />}
          </div>
          {!roboOnline && <p className="nota inicio-nota-robo">O robô está fora do ar. A posição do {pessoa} vem da bengala.</p>}
        </section>

        <section className="painel inicio-hoje" aria-labelledby="titulo-hoje">
          <div className="painel-cabecalho inicio-hoje-cabecalho">
            <h2 id="titulo-hoje" className="titulo-painel">{emergencia && celular ? 'Até agora' : 'Hoje'}</h2>
            {!(emergencia && celular) && <p className="texto-pequeno">{celular || ateTablet ? dataCurta(agora) : dataLonga(agora)}</p>}
          </div>
          {visiveis.length === 0
            ? <p className="inicio-vazio texto-secundario">Nada aconteceu ainda hoje. Os eventos da bengala e do robô aparecem aqui.</p>
            : <ol className="linha-tempo">{visiveis.map((item, i) => <ItemLinhaDoTempo key={item.id} item={item} ultimo={i === visiveis.length - 1} />)}</ol>}
          {maisTarde.length > 0 && !diaTodo && <>
            <hr className="inicio-separador" />
            <p className="rotulo-secao inicio-mais-tarde">Mais tarde</p>
            <ol className="linha-tempo">
              {maisTarde.map((r, i) => <ItemLinhaDoTempo key={r.id} futuro ultimo={i === maisTarde.length - 1}
                item={{ hora: r.hora, titulo: r.nome, detalhe: 'Lembrete na bengala e aqui no painel', tom: 'neutro' }} />)}
            </ol>
          </>}
          <div className="inicio-hoje-rodape">
            {emergencia && celular
              ? <button className="btn-link inicio-encerrar" onClick={() => onResolver(emergencia.id)}>{pessoa} está bem, encerrar</button>
              : itens.length > limite || diaTodo
                ? <button className="btn-link" onClick={() => setDiaTodo(v => !v)} aria-expanded={diaTodo}>
                    {ateTablet && <ArrowRight size={16} aria-hidden="true" />}{diaTodo ? 'Ver menos' : 'Ver o dia todo'}{!ateTablet && <ArrowRight size={16} aria-hidden="true" />}
                  </button>
                : null}
          </div>
        </section>
      </div>

      {!(emergencia && celular) && (
        <section className="painel inicio-fatos" aria-label="Bengala e rotina">
          {fatos.map(f => <Fato key={f.rotulo} {...f} />)}
        </section>
      )}
    </div>
  );
};
