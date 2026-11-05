// Textos e tons dos alertas, usados na linha do tempo (Início) e na Central de avisos.
import type { Alert, AlertType } from '../types';
import type { RobotMission } from '../types/robot';
import type { HouseLayout } from '../types/robot';
import { comodoCurto, naNo } from './resumoDoEstado';

export type TomItem = 'neutro' | 'sucesso' | 'aviso' | 'perigo';
export type CategoriaAviso = 'bengala' | 'robo' | 'camera';

const TITULOS: Record<AlertType, string> = {
  SOS_BUTTON: 'Botão de socorro acionado',
  FALL_DETECTED: 'Queda detectada',
  OBSTACLE_COLLISION: 'Obstáculo muito perto',
  POTHOLE_HOLE_DETECTED: 'Degrau ou buraco no caminho',
  LOW_BATTERY: 'Bateria da bengala fraca',
  GEOFENCE_EXIT: 'Saiu da área segura',
  DEVICE_OFFLINE: 'Bengala sem sinal',
  CHECKIN_SAFE: 'Chegou bem',
  TREMOR_DETECTED: 'Tremor acima do normal',
  FATIGUE_WARNING: 'Sinais de cansaço',
  MEDICATION_REMINDER: 'Lembrete de remédio',
  SUSPICIOUS_PERSON_DETECTED: 'Pessoa desconhecida por perto',
  SUSPICIOUS_PROXIMITY_ALERT: 'Alguém muito perto',
  THREAT_STALKING_WARNING: 'Possível perseguição',
  HAND_GESTURE_SOS: 'Gesto de socorro na câmera',
  AGENT_RECOMMENDATION: 'Sugestão do assistente',
  ROBOT_ARRIVED: 'Robô chegou até ele',
  ROBOT_MISSION_FAILED: 'Robô não conseguiu chegar'
};

const CATEGORIA: Partial<Record<AlertType, CategoriaAviso>> = {
  HAND_GESTURE_SOS: 'camera',
  SUSPICIOUS_PERSON_DETECTED: 'camera',
  SUSPICIOUS_PROXIMITY_ALERT: 'camera',
  THREAT_STALKING_WARNING: 'camera',
  ROBOT_ARRIVED: 'robo',
  ROBOT_MISSION_FAILED: 'robo',
  AGENT_RECOMMENDATION: 'robo'
};

/** Remove emoji e símbolos decorativos que vêm em mensagens antigas. */
export const limparTexto = (texto: string) =>
  texto.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim();

export const tituloAviso = (a: Alert, layout?: HouseLayout) => {
  const onde = layout ? comodoCurto(layout, a.indoorRoom) : null;
  const base = TITULOS[a.alertType] ?? a.alertType;
  return onde && (a.alertType === 'FALL_DETECTED' || a.alertType === 'SOS_BUTTON') ? `${base} ${naNo(onde)}` : base;
};

export const categoriaAviso = (a: Alert): CategoriaAviso => CATEGORIA[a.alertType] ?? 'bengala';

export function tomAviso(a: Alert): TomItem {
  if (a.alertType === 'CHECKIN_SAFE' || a.alertType === 'ROBOT_ARRIVED') return 'sucesso';
  if (a.status !== 'PENDING') return a.severity === 'CRITICAL' ? 'aviso' : 'neutro';
  if (a.severity === 'CRITICAL') return 'perigo';
  if (a.severity === 'WARNING') return 'aviso';
  return 'neutro';
}

export const horaCurta = (iso: string | number | Date) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const ehHoje = (iso: string | number | Date, agora = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate();
};

export const ehOntem = (iso: string | number | Date, agora = new Date()) => {
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  return ehHoje(iso, ontem);
};

export interface ItemDia {
  id: string;
  quando: number;
  hora: string;
  titulo: string;
  detalhe: string;
  tom: TomItem;
}

export function itemDeAviso(a: Alert, layout: HouseLayout): ItemDia {
  const detalhe = limparTexto(a.message);
  const status = a.status === 'RESOLVED' ? ' · resolvido' : a.status === 'ACKNOWLEDGED' ? ' · visto' : '';
  return {
    id: `a${a.id}`, quando: new Date(a.createdAt).getTime(), hora: horaCurta(a.createdAt),
    titulo: tituloAviso(a, layout), detalhe: `${detalhe}${status}`, tom: tomAviso(a)
  };
}

export function itemDeMissao(m: RobotMission, layout: HouseLayout): ItemDia | null {
  const quando = new Date(m.finishedAt ?? m.startedAt ?? m.createdAt).getTime();
  const onde = comodoCurto(layout, m.targetRoom);
  const base = { id: `m${m.id}`, quando, hora: horaCurta(quando) };
  if (m.status === 'FAILED') return { ...base, titulo: 'Robô não completou o comando', detalhe: limparTexto(m.resultMessage ?? 'Tentará de novo no próximo ciclo'), tom: 'aviso' };
  if (m.status !== 'COMPLETED') return null;
  switch (m.type) {
    case 'PATROL': return { ...base, titulo: 'Robô fez a ronda', detalhe: 'Ronda concluída, tudo normal', tom: 'sucesso' };
    case 'GO_TO_ROOM': return { ...base, titulo: `Robô passou pela ${onde ?? 'casa'}`, detalhe: limparTexto(m.resultMessage ?? 'Comando concluído'), tom: 'sucesso' };
    case 'RESPOND_TO_ALERT': return { ...base, titulo: 'Robô chegou até ele', detalhe: limparTexto(m.resultMessage ?? 'Atendimento do socorro'), tom: 'sucesso' };
    case 'RETURN_TO_DOCK': return { ...base, titulo: 'Robô voltou à base', detalhe: 'Carregando', tom: 'neutro' };
    default: return { ...base, titulo: 'Robô chegou ao ponto escolhido', detalhe: limparTexto(m.resultMessage ?? 'Comando concluído'), tom: 'neutro' };
  }
}
