import React, { useRef } from 'react';
import { gsap, movimentoReduzido, useGSAP } from './gsap';
import { DUR } from './tokens';

const padrao = (n: number) => Math.round(n).toLocaleString('pt-BR');

/**
 * Número que conta rapidamente (300 ms) do valor anterior até o novo, só quando o valor muda.
 * Na primeira vez aparece pronto (ou conta desde 0, com `doZero`); com movimento reduzido, troca direto.
 */
export const Contador: React.FC<{ valor: number; formatar?: (n: number) => string; doZero?: boolean; duracao?: number }> = ({ valor, formatar = padrao, doZero, duracao = DUR.media }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const atual = useRef<number | null>(doZero ? 0 : null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    const de = atual.current;
    atual.current = valor;
    if (de === null || de === valor || movimentoReduzido()) { el.textContent = formatar(valor); return; }
    const obj = { n: de };
    gsap.to(obj, {
      n: valor, duration: duracao, ease: 'power2.out', overwrite: true,
      onUpdate: () => { el.textContent = formatar(obj.n); },
      onComplete: () => { el.textContent = formatar(valor); }
    });
  }, { dependencies: [valor] });

  // O texto é escrito só pelo efeito (antes da pintura), para o React e o GSAP não disputarem o mesmo nó.
  return <span ref={ref} className="contador-numero" />;
};
