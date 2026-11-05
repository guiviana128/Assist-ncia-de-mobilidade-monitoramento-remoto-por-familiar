import { Activity, Box, Home, Video, type LucideIcon } from 'lucide-react';

export type AppTab = 'inicio' | 'casa' | 'monitorar' | 'camera';
/** Telas: as 4 abas mais Configurações (aberta pelo menu da conta). */
export type AppView = AppTab | 'configuracoes';

export const ABAS: { id: AppTab; rotulo: string; Icone: LucideIcon }[] = [
  { id: 'inicio', rotulo: 'Início', Icone: Home },
  { id: 'casa', rotulo: 'Casa 3D', Icone: Box },
  { id: 'monitorar', rotulo: 'Monitorar', Icone: Activity },
  { id: 'camera', rotulo: 'Câmera e SOS', Icone: Video }
];

export const ABA_PADRAO: AppTab = 'inicio';
