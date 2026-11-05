import React from 'react';
import type { Tom } from '../../lib/resumoDoEstado';

interface FraseEstadoProps {
  tom?: Tom;
  forte: string;
  apoio?: string;
  detalhe?: React.ReactNode;
  /** Ações à direita no computador; embaixo no celular. */
  acoes?: React.ReactNode;
  /** Mostra o ponto colorido antes da frase (Início). */
  indicador?: boolean;
  as?: 'h1' | 'h2';
}

/** Frase de topo de cada tela: "**Parte forte.** parte em cinza". */
export const FraseEstado: React.FC<FraseEstadoProps> = ({ tom = 'neutro', forte, apoio, detalhe, acoes, indicador, as: Tag = 'h1' }) => (
  <section className={`frase-estado is-${tom}${indicador ? ' tem-indicador' : ''}`} aria-live="polite">
    <div className="frase-estado-texto">
      <Tag className="frase">
        {indicador && <span className="frase-indicador" aria-hidden="true" />}
        {forte}<span className="frase-apoio">{apoio}</span>
      </Tag>
      {detalhe && <p className="frase-detalhe">{detalhe}</p>}
    </div>
    {acoes && <div className="frase-estado-acoes">{acoes}</div>}
  </section>
);
