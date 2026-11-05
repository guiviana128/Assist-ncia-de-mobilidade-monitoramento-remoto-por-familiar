/*
 * Registro único do GSAP e dos plugins (todos gratuitos, no pacote "gsap").
 * Importe gsap, Flip e useGSAP sempre daqui, para garantir que os plugins já estão registrados.
 */
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { DUR, EASE_GSAP, REDUZIDO } from './tokens';

gsap.registerPlugin(useGSAP, Flip, DrawSVGPlugin, CustomEase);
CustomEase.create(EASE_GSAP, '0.16,1,0.3,1');
gsap.defaults({ ease: EASE_GSAP, duration: DUR.curta });

// Com a aba do navegador oculta, nenhum tween avança (os loops param de gastar CPU e retomam de onde estavam).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { gsap.globalTimeline.paused(document.hidden); });
}

/** Leitura pontual da preferência do sistema (para decisões fora de gsap.matchMedia). */
export const movimentoReduzido = () =>
  typeof window !== 'undefined' && window.matchMedia(REDUZIDO).matches;

export { gsap, useGSAP, Flip };
