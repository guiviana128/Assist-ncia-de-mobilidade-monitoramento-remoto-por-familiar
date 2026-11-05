import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo, type Variants } from 'motion/react';
import { X } from 'lucide-react';
import { DUR, EASE_MOTION, saida } from '../../motion/tokens';

export type ModoCamada = 'popover' | 'lateral' | 'folha';

interface CamadaProps {
  aberta: boolean;
  onFechar: () => void;
  modo: ModoCamada;
  titulo: string;
  /** Esconde o título visualmente (menu da conta), mas mantém o nome acessível. */
  semCabecalho?: boolean;
  /** Elemento à direita do título (ex.: "Marcar tudo como visto"). */
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const t = (duration: number) => ({ duration, ease: EASE_MOTION });

/**
 * Entrada e saída de cada modo (saída 30% mais rápida):
 * popover cresce a partir do botão (0,96 → 1 + fade, 200 ms); painel lateral entra da direita (300 ms);
 * folha inferior sobe de baixo (300 ms). Com movimento reduzido, tudo vira só fade.
 */
const PAINEL: Record<ModoCamada, Variants> = {
  popover: {
    fora: { opacity: 0, scale: 0.96, transition: t(saida(DUR.curta)) },
    dentro: { opacity: 1, scale: 1, transition: t(DUR.curta) }
  },
  lateral: {
    fora: { x: '100%', transition: t(saida(DUR.media)) },
    dentro: { x: 0, transition: t(DUR.media) }
  },
  folha: {
    fora: { y: '100%', transition: t(saida(DUR.media)) },
    dentro: { y: 0, transition: t(DUR.media) }
  }
};
const PAINEL_REDUZIDO: Variants = {
  fora: { opacity: 0, transition: t(saida(DUR.curta)) },
  dentro: { opacity: 1, transition: t(DUR.curta) }
};
const VEU: Variants = {
  fora: { opacity: 0, transition: t(saida(DUR.media)) },
  dentro: { opacity: 1, transition: t(DUR.media) }
};

/** A folha fecha se for arrastada mais de 30% da altura ou jogada para baixo com velocidade. */
const FECHA_FRACAO = 0.3;
const FECHA_VELOCIDADE = 600;

/**
 * Popover (computador), painel lateral (Simulador no computador) ou folha inferior (celular).
 * Fecha com Esc e com clique fora; o foco entra na camada e volta para quem a abriu.
 */
export const Camada: React.FC<CamadaProps> = ({ aberta, onFechar, modo, titulo, semCabecalho, extra, className, children }) => {
  const painel = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLElement | null>(null);
  const tituloId = useId();
  const reduzido = !!useReducedMotion();
  const arrasto = useDragControls();

  // Quem abriu a camada (para o foco voltar e para o popover crescer a partir do botão)
  if (aberta && !gatilho.current && typeof document !== 'undefined') {
    gatilho.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  }

  // Popover: transform-origin no botão que abriu, calculado antes da primeira pintura
  useLayoutEffect(() => {
    if (!aberta || modo !== 'popover' || !painel.current) return;
    const el = painel.current;
    const botao = gatilho.current?.getBoundingClientRect();
    const caixa = el.getBoundingClientRect();
    el.style.transformOrigin = botao && botao.width
      ? `${Math.round(botao.left + botao.width / 2 - caixa.left)}px ${Math.round(botao.top + botao.height / 2 - caixa.top)}px`
      : 'top right';
  }, [aberta, modo]);

  useEffect(() => {
    if (!aberta) return;
    const anterior = gatilho.current;
    const foco = painel.current?.querySelector<HTMLElement>('[data-autofoco], button, a[href], input, select, [tabindex]:not([tabindex="-1"])');
    (foco ?? painel.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', onKey);
    const travar = modo !== 'popover';
    if (travar) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      if (travar) document.body.style.overflow = '';
      gatilho.current = null;
      anterior?.focus?.({ preventScroll: true });
    };
  }, [aberta, modo, onFechar]);

  // O arrasto da folha vale também com movimento reduzido: é a pessoa movendo, não uma animação.
  const soltar = (_: unknown, info: PanInfo) => {
    const altura = painel.current?.offsetHeight ?? 1;
    if (info.offset.y > altura * FECHA_FRACAO || info.velocity.y > FECHA_VELOCIDADE) onFechar();
  };
  const folha = modo === 'folha';
  const comecarArrasto = folha ? (e: React.PointerEvent) => arrasto.start(e) : undefined;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {aberta && (
        <div key="camada" className={`camada camada-${modo}`}>
          <motion.div className="camada-fundo" onClick={onFechar} aria-hidden="true"
            variants={VEU} initial="fora" animate="dentro" exit="fora" />
          <motion.div ref={painel} className={`camada-painel ${className ?? ''}`} role="dialog" aria-modal={modo !== 'popover'}
            aria-labelledby={tituloId} tabIndex={-1}
            variants={reduzido ? PAINEL_REDUZIDO : PAINEL[modo]} initial="fora" animate="dentro" exit="fora"
            drag={folha ? 'y' : false} dragListener={false} dragControls={arrasto}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} dragMomentum={false}
            onDragEnd={folha ? soltar : undefined}>
            {folha && <span className="camada-alca" aria-hidden="true" onPointerDown={comecarArrasto} />}
            <header className={`camada-cabecalho${semCabecalho ? ' sr-only' : ''}`} onPointerDown={comecarArrasto}>
              <h2 id={tituloId} className="camada-titulo">{titulo}</h2>
              {extra}
              {modo !== 'popover' && (
                <button className="btn-icone is-redondo" onClick={onFechar} aria-label={`Fechar ${titulo.toLowerCase()}`}>
                  <X size={20} />
                </button>
              )}
            </header>
            <div className="camada-conteudo">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
