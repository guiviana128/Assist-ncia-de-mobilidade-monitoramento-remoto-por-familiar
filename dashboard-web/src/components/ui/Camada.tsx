import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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

/**
 * Popover (computador), painel lateral (Simulador no computador) ou folha inferior (celular).
 * Fecha com Esc e com clique fora; o foco entra na camada e volta para quem a abriu.
 */
export const Camada: React.FC<CamadaProps> = ({ aberta, onFechar, modo, titulo, semCabecalho, extra, className, children }) => {
  const painel = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement as HTMLElement | null;
    const foco = painel.current?.querySelector<HTMLElement>('[data-autofoco], button, a[href], input, select, [tabindex]:not([tabindex="-1"])');
    (foco ?? painel.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', onKey);
    const travar = modo !== 'popover';
    if (travar) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      if (travar) document.body.style.overflow = '';
      anterior?.focus?.();
    };
  }, [aberta, modo, onFechar]);

  if (!aberta) return null;

  return createPortal(
    <div className={`camada camada-${modo}`}>
      <div className="camada-fundo" onClick={onFechar} aria-hidden="true" />
      <div ref={painel} className={`camada-painel ${className ?? ''}`} role="dialog" aria-modal={modo !== 'popover'}
        aria-labelledby={tituloId} tabIndex={-1}>
        {modo === 'folha' && <span className="camada-alca" aria-hidden="true" />}
        <header className={`camada-cabecalho${semCabecalho ? ' sr-only' : ''}`}>
          <h2 id={tituloId} className="camada-titulo">{titulo}</h2>
          {extra}
          {modo !== 'popover' && (
            <button className="btn-icone is-redondo" onClick={onFechar} aria-label={`Fechar ${titulo.toLowerCase()}`}>
              <X size={20} />
            </button>
          )}
        </header>
        <div className="camada-conteudo">{children}</div>
      </div>
    </div>,
    document.body
  );
};
