import React from 'react';
import { Bot, Check } from 'lucide-react';

export type EstadoPasso = 'feito' | 'atual' | 'pendente' | 'socorro';
export interface Passo { estado: EstadoPasso; titulo: string; detalhe?: string }

/** Passos da missão do robô (Figma: PassoMissao). */
export const PassosMissao: React.FC<{ passos: Passo[]; rotulo: string }> = ({ passos, rotulo }) => (
  <ol className="passos-missao" aria-label={rotulo}>
    {passos.map((p, i) => (
      <li key={i} className={`passo-missao is-${p.estado}`} aria-current={p.estado === 'atual' || p.estado === 'socorro' ? 'step' : undefined}>
        <span className="passo-missao-trilho" aria-hidden="true">
          <span className="passo-missao-marcador">{p.estado === 'feito' && <Check size={14} strokeWidth={3} />}</span>
          {i < passos.length - 1 && <span className="passo-missao-linha" />}
        </span>
        <span className="passo-missao-textos">
          <span className="passo-missao-titulo">{p.titulo}</span>
          {p.detalhe && <span className="passo-missao-detalhe">{p.detalhe}</span>}
        </span>
        <span className="sr-only">{p.estado === 'feito' ? '(concluído)' : p.estado === 'pendente' ? '(a seguir)' : '(agora)'}</span>
      </li>
    ))}
  </ol>
);

/** Robô fora da planta (cabeçalhos): mesmo desenho do MarcadorRobo. */
export const MarcadorRoboIcone: React.FC<{ estado?: 'patrulha' | 'socorro' | 'offline' }> = ({ estado = 'patrulha' }) => (
  <span className={`marcador-robo-html is-${estado}`} aria-hidden="true">
    <span className="marcador-robo-html-corpo"><Bot size={18} /></span>
  </span>
);
