import React, { useRef } from 'react';
import { Bot, Check } from 'lucide-react';
import { gsap, movimentoReduzido, useGSAP } from '../../motion/gsap';
import { DUR, SEM_REDUCAO } from '../../motion/tokens';

export type EstadoPasso = 'feito' | 'atual' | 'pendente' | 'socorro';
export interface Passo { estado: EstadoPasso; titulo: string; detalhe?: string }

interface PassosMissaoProps {
  passos: Passo[];
  rotulo: string;
  /** Ao aparecer, as etapas já feitas viram ✓ com animação (ex.: logo depois de enviar o robô). */
  animarEntrada?: boolean;
  /** A etapa atual pulsa uma vez só (cadastro), em vez do pulso lento em loop (missão do robô). */
  pulsoUnico?: boolean;
}

/**
 * Passos da missão do robô (Figma: PassoMissao; animação 19:1312).
 * A etapa atual pulsa devagar (1,6 s). Ao avançar, o marcador vira check (200 ms)
 * e a linha enche de verde de cima para baixo (scaleY 0 → 1, 300 ms).
 */
export const PassosMissao: React.FC<PassosMissaoProps> = ({ passos, rotulo, animarEntrada, pulsoUnico }) => {
  const lista = useRef<HTMLOListElement>(null);
  const antes = useRef<EstadoPasso[] | null>(animarEntrada ? passos.map(() => 'pendente') : null);
  const chave = passos.map(p => p.estado).join(',');

  useGSAP(() => {
    const anterior = antes.current;
    antes.current = passos.map(p => p.estado);

    // Etapa atual: pulso lento em loop (some com movimento reduzido)
    const mm = gsap.matchMedia();
    mm.add(SEM_REDUCAO, () => {
      gsap.fromTo('.passo-missao-pulso', { scale: 1, opacity: 0.45 }, { scale: 1.9, opacity: 0, duration: 1.6, ease: 'sine.out', repeat: pulsoUnico ? 0 : -1 });
    });

    if (anterior) {
      const itens = gsap.utils.toArray<HTMLElement>('.passo-missao');
      passos.forEach((p, i) => {
        if (p.estado !== 'feito' || anterior[i] === 'feito' || !itens[i]) return;
        const check = itens[i]!.querySelector('.passo-missao-marcador svg');
        const linha = itens[i]!.querySelector('.passo-missao-linha-cheia');
        if (movimentoReduzido()) {
          if (check) gsap.from(check, { opacity: 0, duration: DUR.curta });
          return;
        }
        if (check) gsap.from(check, { scale: 0.4, opacity: 0, duration: DUR.curta, transformOrigin: '50% 50%' });
        if (linha) gsap.from(linha, { scaleY: 0, duration: DUR.media, delay: 0.1, ease: 'power2.out' });
      });
    }
    return () => mm.revert();
  }, { scope: lista, dependencies: [chave], revertOnUpdate: true });

  return (
    <ol ref={lista} className="passos-missao" aria-label={rotulo}>
      {passos.map((p, i) => (
        <li key={i} className={`passo-missao is-${p.estado}`} aria-current={p.estado === 'atual' || p.estado === 'socorro' ? 'step' : undefined}>
          <span className="passo-missao-trilho" aria-hidden="true">
            <span className="passo-missao-marcador">
              {(p.estado === 'atual' || p.estado === 'socorro') && <span className="passo-missao-pulso" />}
              {p.estado === 'feito' && <Check size={14} strokeWidth={3} />}
            </span>
            {i < passos.length - 1 && <span className="passo-missao-linha"><span className="passo-missao-linha-cheia" /></span>}
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
};

/** Robô fora da planta (cabeçalhos): mesmo desenho do MarcadorRobo. */
export const MarcadorRoboIcone: React.FC<{ estado?: 'patrulha' | 'socorro' | 'offline' }> = ({ estado = 'patrulha' }) => (
  <span className={`marcador-robo-html is-${estado}`} aria-hidden="true">
    <span className="marcador-robo-html-corpo"><Bot size={18} /></span>
  </span>
);
