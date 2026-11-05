// Frase de topo das telas: "**Parte forte.** parte em cinza", gerada a partir do estado real.
import type { Alert, DeviceStatus } from '../types';
import type { HouseLayout, RobotState } from '../types/robot';
import { roomName } from '../robot/houseLayout';

export type Tom = 'sucesso' | 'aviso' | 'perigo' | 'neutro';

export interface Resumo {
  tom: Tom;
  /** Parte em negrito, termina com ponto. */
  forte: string;
  /** Continuação em cinza. */
  apoio: string;
  /** Linha pequena abaixo da frase (conexão · robô · atualização). */
  detalhe: string;
}

export const TIPOS_EMERGENCIA: Alert['alertType'][] = ['FALL_DETECTED', 'SOS_BUTTON', 'HAND_GESTURE_SOS'];

export const emergenciaPendente = (alerts: Alert[] | undefined): Alert | undefined =>
  alerts?.find(a => a.status === 'PENDING' && TIPOS_EMERGENCIA.includes(a.alertType));

/** "Dispositivo Amparo (José Silva)" -> "José". */
export function nomePessoa(device?: DeviceStatus | null): string {
  const entre = device?.name.match(/\(([^)]+)\)/)?.[1]?.trim();
  return entre?.split(/\s+/)[0] || 'José';
}

/** Nome curto do cômodo para frases ("Sala de estar" -> "Sala"). */
export function comodoCurto(layout: HouseLayout, id?: string | null): string | null {
  if (!id) return null;
  const nome = roomName(layout, id);
  return nome === 'Sala de estar' ? 'Sala' : nome;
}

/** "na Sala", "no Quarto": cômodos terminados em "a" (e Sala/Cozinha) são femininos. */
export const naNo = (comodo: string) => `${/a$/i.test(comodo) ? 'na' : 'no'} ${comodo}`;

/** Preposição + cômodo para frases, a partir do id ("cozinha" -> "na Cozinha"). */
export const noComodo = (layout: HouseLayout, id?: string | null): string | null => {
  const nome = comodoCurto(layout, id);
  return nome ? naNo(nome) : null;
};

export function haQuanto(desde: Date | string | number | null | undefined, agora = Date.now()): string {
  if (desde == null) return '';
  const ms = agora - new Date(desde).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'agora';
  const s = Math.round(ms / 1000);
  if (s < 60) return `há ${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

export const TITULO_EMERGENCIA: Partial<Record<Alert['alertType'], string>> = {
  FALL_DETECTED: 'Queda detectada',
  SOS_BUTTON: 'Botão de socorro acionado',
  HAND_GESTURE_SOS: 'Gesto de socorro na câmera'
};

export function descricaoRobo(robot: RobotState | null | undefined, layout: HouseLayout): string {
  if (!robot) return 'robô sem notícias';
  if (!robot.online || robot.mode === 'OFFLINE') return 'robô fora do ar';
  const onde = comodoCurto(layout, robot.currentMission?.targetRoom ?? robot.personRoom);
  switch (robot.mode) {
    case 'PATROLLING': return 'robô fazendo a ronda';
    case 'RESPONDING': return onde ? `robô indo até ${onde.toLowerCase().startsWith('sala') || onde === 'Cozinha' ? 'a' : 'o'} ${onde}` : 'robô a caminho';
    case 'CHECKING_PERSON': return 'robô ao lado dele';
    case 'GOING_TO_GOAL': return 'robô cumprindo um comando';
    case 'RETURNING': return 'robô voltando à base';
    default: return 'robô na base';
  }
}

export interface EntradaResumo {
  carregando: boolean;
  demo: boolean;
  device?: DeviceStatus | null;
  alerts: Alert[];
  robot?: RobotState | null;
  layout: HouseLayout;
  /** Quando o José foi visto pela primeira vez no cômodo atual (medido pelo painel). */
  noComodoDesde?: number | null;
  atualizado?: Date | null;
  agora?: number;
}

export function resumoDoEstado(e: EntradaResumo): Resumo {
  const agora = e.agora ?? Date.now();
  const pessoa = nomePessoa(e.device);
  const conexao = e.demo ? 'Modo demonstração' : e.device?.isOnline ? 'Bengala conectada' : 'Sem sinal da bengala';
  const atualizado = e.atualizado ? `atualizado ${haQuanto(e.atualizado, agora)}` : '';
  const detalhe = [conexao, descricaoRobo(e.robot, e.layout), atualizado].filter(Boolean).join('  ·  ');

  if (e.carregando) {
    return { tom: 'neutro', forte: 'Conectando.', apoio: ' Buscando as notícias da casa.', detalhe: 'Isso leva alguns segundos' };
  }

  const emergencia = emergenciaPendente(e.alerts);
  if (emergencia) {
    const onde = comodoCurto(e.layout, emergencia.indoorRoom);
    const naOnde = onde ? ` ${naNo(onde)}` : '';
    const forte = emergencia.alertType === 'FALL_DETECTED' ? `${pessoa} caiu${naOnde}.`
      : emergencia.alertType === 'SOS_BUTTON' ? `${pessoa} pediu socorro${naOnde}.`
        : `${pessoa} fez o sinal de socorro.`;
    const robo = e.robot?.online === false ? ' O robô está fora do ar.'
      : e.robot?.mode === 'RESPONDING' ? ' O robô está indo até ele.'
        : e.robot?.mode === 'CHECKING_PERSON' ? ' O robô está ao lado dele.' : ' Ligue para ele agora.';
    const origem = emergencia.alertType === 'FALL_DETECTED' ? 'Queda detectada pela bengala'
      : emergencia.alertType === 'SOS_BUTTON' ? 'Botão de socorro da bengala' : 'Gesto reconhecido pela câmera';
    const hora = new Date(emergencia.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return {
      tom: 'perigo',
      forte,
      apoio: robo,
      detalhe: `${origem} às ${hora}  ·  ${haQuanto(emergencia.createdAt, agora)}`
    };
  }

  if (!e.device) {
    return { tom: 'neutro', forte: 'Nenhuma bengala cadastrada.', apoio: ' Confira o cadastro do dispositivo.', detalhe };
  }

  if (!e.demo && !e.device.isOnline) {
    const ultima = e.device.lastUpdate ? ` Última notícia ${haQuanto(e.device.lastUpdate, agora)}.` : '';
    return { tom: 'aviso', forte: 'Sem sinal da bengala.', apoio: ultima || ' Verifique se ela está ligada.', detalhe };
  }

  const pendentes = e.alerts.filter(a => a.status === 'PENDING');
  const onde = comodoCurto(e.layout, e.robot?.personRoom);
  const ondeFrase = onde
    ? ` ${pessoa} está ${naNo(onde)}${e.noComodoDesde ? ` ${haQuanto(e.noComodoDesde, agora)}` : ''}.`
    : ` ${pessoa} está com a bengala.`;

  if (pendentes.length > 0) {
    return {
      tom: 'aviso',
      forte: pendentes.length === 1 ? 'Um aviso para ver.' : `${pendentes.length} avisos para ver.`,
      apoio: ondeFrase,
      detalhe
    };
  }

  if (e.device.batteryPercent <= 20) {
    return { tom: 'aviso', forte: 'Bateria fraca.', apoio: ` A bengala está com ${Math.round(e.device.batteryPercent)}%.`, detalhe };
  }

  return { tom: 'sucesso', forte: 'Tudo certo.', apoio: ondeFrase, detalhe };
}
