import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import type { ItemDia } from '../../lib/avisos';
import { DESLOCA, EASE_MOTION, QUEDA } from '../../motion/tokens';

interface ItemProps {
  item: Pick<ItemDia, 'hora' | 'titulo' | 'detalhe' | 'tom'>;
  ultimo?: boolean;
  futuro?: boolean;
  /** Entra no topo da lista ao aparecer (240 ms, desliza 8 px). Use dentro de um AnimatePresence initial={false}. */
  entra?: boolean;
  /** Espera antes de entrar (s), ex.: o evento da queda entra no passo 4 da sequência. */
  atraso?: number;
}

/** Evento do dia (Figma: ItemLinhaDoTempo, tons Neutro/Sucesso/Aviso/Perigo). */
export const ItemLinhaDoTempo: React.FC<ItemProps> = ({ item, ultimo, futuro, entra, atraso = 0 }) => (
  <motion.li className={`item-tempo is-${item.tom}${futuro ? ' is-futuro' : ''}`}
    initial={entra ? { opacity: 0, y: -DESLOCA } : false} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: QUEDA.duracaoEvento, ease: EASE_MOTION, delay: atraso }}>
    <span className="item-tempo-hora">{item.hora}</span>
    <span className="item-tempo-trilho" aria-hidden="true">
      <span className="item-tempo-marcador" />
      {!ultimo && <span className="item-tempo-linha" />}
    </span>
    <span className="item-tempo-conteudo">
      <span className="item-tempo-titulo">{item.titulo}</span>
      {item.detalhe && <span className="item-tempo-detalhe">{item.detalhe}</span>}
    </span>
  </motion.li>
);

/** Um fato curto com contexto (Figma: Fato). Nunca o número solto. */
export const Fato: React.FC<{ Icone: LucideIcon; rotulo: string; valor: React.ReactNode }> = ({ Icone, rotulo, valor }) => (
  <div className="fato">
    <span className="fato-icone" aria-hidden="true"><Icone size={20} /></span>
    <span className="fato-textos">
      <span className="fato-rotulo">{rotulo}</span>
      <span className="fato-valor">{valor}</span>
    </span>
  </div>
);
