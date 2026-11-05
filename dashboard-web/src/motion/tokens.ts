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

/**
 * Momento principal do Início: a queda (~900 ms, em sequência). Cada parte vive num componente
 * diferente (frase, planta, linha do tempo, faixa), por isso os inícios ficam aqui, num só lugar.
 * A volta ao normal faz o caminho inverso em 60% do tempo, sem esperas.
 */
export const QUEDA = {
  frase: 0,       // 1) a frase troca com fade de 200 ms
  onda: 0.1,      // 2) o cômodo fica vermelho numa onda que sai do pino (600 ms)
  robo: 0.35,     // 3) o robô fica vermelho (e segue deslizando pela rota)
  evento: 0.5,    // 4) o evento entra no topo da linha do tempo (240 ms, 8 px)
  faixa: 0.55,    // 5) a faixa de emergência desce da navbar…
  botoes: 0.62,   //    …e os botões entram de cima para baixo
  stagger: 0.06,
  duracaoOnda: 0.6,
  duracaoEvento: 0.24,
  volta: 0.6
} as const;

/** Robô na planta 2D: interpolação entre duas leituras da API. */
export const ROBO_INTERPOLA = 0.9;
