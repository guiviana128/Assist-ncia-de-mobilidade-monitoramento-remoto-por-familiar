/*
 * Tempos e curvas do Amparo (Figma 14:987 e 19:1312, "Regras").
 * Curva única cubic-bezier(0.16, 1, 0.3, 1); saídas 30% mais rápidas que entradas; sem bounce nem elástico.
 */
export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Mesma curva para o Motion. */
export const EASE_MOTION = [0.16, 1, 0.3, 1] as const;
/** Nome da curva registrada no GSAP (CustomEase, em motion/gsap.ts). */
export const EASE_GSAP = 'amparo';

/** Durações em segundos. */
export const DUR = { rapida: 0.15, curta: 0.2, media: 0.3, longa: 0.45, cena: 0.9 } as const;

/** Saída 30% mais rápida que a entrada correspondente. */
export const saida = (entrada: number) => Math.round(entrada * 0.7 * 1000) / 1000;

/** Deslocamento padrão de entrada (px). */
export const DESLOCA = 8;

export const REDUZIDO = '(prefers-reduced-motion: reduce)';
export const SEM_REDUCAO = '(prefers-reduced-motion: no-preference)';
