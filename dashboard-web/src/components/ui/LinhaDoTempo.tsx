import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ItemDia } from '../../lib/avisos';

/** Evento do dia (Figma: ItemLinhaDoTempo, tons Neutro/Sucesso/Aviso/Perigo). */
export const ItemLinhaDoTempo: React.FC<{ item: Pick<ItemDia, 'hora' | 'titulo' | 'detalhe' | 'tom'>; ultimo?: boolean; futuro?: boolean }> = ({ item, ultimo, futuro }) => (
  <li className={`item-tempo is-${item.tom}${futuro ? ' is-futuro' : ''}`}>
    <span className="item-tempo-hora">{item.hora}</span>
    <span className="item-tempo-trilho" aria-hidden="true">
      <span className="item-tempo-marcador" />
      {!ultimo && <span className="item-tempo-linha" />}
    </span>
    <span className="item-tempo-conteudo">
      <span className="item-tempo-titulo">{item.titulo}</span>
      {item.detalhe && <span className="item-tempo-detalhe">{item.detalhe}</span>}
    </span>
  </li>
);

/** Um fato curto com contexto (Figma: Fato). Nunca o número solto. */
export const Fato: React.FC<{ Icone: LucideIcon; rotulo: string; valor: string }> = ({ Icone, rotulo, valor }) => (
  <div className="fato">
    <span className="fato-icone" aria-hidden="true"><Icone size={20} /></span>
    <span className="fato-textos">
      <span className="fato-rotulo">{rotulo}</span>
      <span className="fato-valor">{valor}</span>
    </span>
  </div>
);
