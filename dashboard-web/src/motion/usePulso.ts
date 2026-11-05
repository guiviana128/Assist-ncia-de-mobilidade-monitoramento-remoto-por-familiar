import type { RefObject } from 'react';
import { gsap, useGSAP } from './gsap';
import { REDUZIDO, SEM_REDUCAO } from './tokens';

/**
 * "Pulso 1" e "Pulso 2": anéis que respiram em volta do pino do José (Figma 14:987).
 * Escala 0,85 → 1,15 e opacidade → 0, 2,4 s em loop, um defasado do outro; em alerta, 1,2 s.
 * Procura os elementos [data-pulso] dentro do escopo. Com movimento reduzido não há pulso.
 * `chave` reinicia o loop (ex.: o pino mudou de cômodo e a origem da escala mudou).
 */
export function usePulso(escopo: RefObject<Element>, alerta: boolean, chave: unknown) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(SEM_REDUCAO, () => {
      const aneis = gsap.utils.toArray<Element>('[data-pulso]');
      const periodo = alerta ? 1.2 : 2.4;
      aneis.forEach((anel, i) => {
        const base = Number(getComputedStyle(anel).opacity) || 0.15;
        gsap.fromTo(anel, { scale: 0.85, opacity: base, transformOrigin: '50% 50%' }, {
          scale: 1.15, opacity: 0, duration: periodo, ease: 'sine.out', repeat: -1,
          delay: (i * periodo) / aneis.length
        });
      });
    });
    mm.add(REDUZIDO, () => undefined);
    return () => mm.revert();
  }, { scope: escopo, dependencies: [alerta, chave], revertOnUpdate: true });
}
