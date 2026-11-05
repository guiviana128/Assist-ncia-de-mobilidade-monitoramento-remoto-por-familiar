import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, Bell, HeartPulse, User } from 'lucide-react';
import { DESLOCA, DUR, EASE_MOTION, QUEDA } from '../../motion/tokens';
import { ABAS, type AppTab, type AppView } from './navegacao';
import { StatusConexao, type EstadoConexao } from '../ui/StatusConexao';

interface BotoesTopoProps {
  avisosPendentes: number;
  avisosAbertos: boolean;
  contaAberta: boolean;
  usuario: string | null;
  onAvisos: () => void;
  onConta: () => void;
  /** No celular o sino mostra só um ponto vermelho (TopoMobile). */
  compacto?: boolean;
}

const BotoesTopo: React.FC<BotoesTopoProps> = ({ avisosPendentes, avisosAbertos, contaAberta, usuario, onAvisos, onConta, compacto }) => (
  <>
    <button className={`btn-icone${compacto ? ' is-redondo is-claro' : ''}`} onClick={onAvisos}
      aria-label={avisosPendentes ? `Avisos, ${avisosPendentes} sem resposta` : 'Avisos'} aria-haspopup="dialog"
      aria-expanded={avisosAbertos} title="Avisos">
      <Bell size={20} aria-hidden="true" />
      {avisosPendentes > 0 && (compacto
        ? <span className="ponto-aviso" aria-hidden="true" />
        : <span className="contador" aria-hidden="true">{avisosPendentes > 9 ? '9+' : avisosPendentes}</span>)}
    </button>
    <button className={`btn-icone is-redondo${compacto ? ' is-claro' : ''}`} onClick={onConta}
      aria-label={`Conta de ${usuario ?? 'família'}`} aria-haspopup="dialog" aria-expanded={contaAberta} title="Conta">
      <User size={20} aria-hidden="true" />
    </button>
  </>
);

interface NavbarProps extends BotoesTopoProps {
  view: AppView;
  conexao: EstadoConexao;
  onSelecionar: (tab: AppTab) => void;
  /** Faixa de emergência, logo abaixo da barra. */
  faixa?: React.ReactNode;
}

/** O fundo da aba ativa desliza de uma aba para a outra (layoutId do Motion, 300 ms). */
const DESLIZE = { layout: { duration: DUR.media, ease: EASE_MOTION } };

/**
 * Faixa de emergência: desce da navbar no passo 5 da queda; na volta ao normal, sai só com fade em 60% do tempo.
 * (Com movimento reduzido o MotionConfig desliga o deslocamento e fica só o fade.)
 */
const FAIXA = {
  initial: { opacity: 0, y: -DESLOCA * 2 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.media, ease: EASE_MOTION, delay: QUEDA.faixa } },
  exit: { opacity: 0, transition: { duration: DUR.media * QUEDA.volta, ease: EASE_MOTION } }
};

/** Navbar flutuante do computador (≥ 1024 px). Variantes Normal / Demonstração / Emergência. */
export const Navbar: React.FC<NavbarProps> = ({ view, conexao, onSelecionar, faixa, ...botoes }) => (
  <header className={`navbar${faixa ? ' is-emergencia' : ''}${conexao === 'demonstracao' ? ' is-demonstracao' : ''}`}>
    <div className="navbar-barra">
      <div className="marca">
        <span className="marca-simbolo" aria-hidden="true"><Activity size={24} /></span>
        <span className="marca-nome">Amparo<small>Telecuidado familiar</small></span>
      </div>
      <span className="navbar-divisor" aria-hidden="true" />
      <nav className="navbar-abas" aria-label="Navegação principal">
        {ABAS.map(({ id, rotulo, Icone }) => (
          <button key={id} className={`nav-item${view === id ? ' is-ativo' : ''}`}
            aria-current={view === id ? 'page' : undefined} onClick={() => onSelecionar(id)}>
            {view === id && <motion.span layoutId="navbar-aba-ativa" className="nav-item-fundo" transition={DESLIZE} aria-hidden="true" />}
            <Icone size={20} aria-hidden="true" />{rotulo}
          </button>
        ))}
      </nav>
      <div className="navbar-acoes">
        <StatusConexao estado={conexao} />
        <BotoesTopo {...botoes} />
      </div>
    </div>
    <AnimatePresence initial={false}>
      {faixa && <motion.div key="faixa" className="navbar-faixa" {...FAIXA}>{faixa}</motion.div>}
    </AnimatePresence>
  </header>
);

interface TopoMobileProps extends BotoesTopoProps {
  conexao: EstadoConexao;
  faixa?: React.ReactNode;
}

/** Topo compacto do celular e do tablet (< 1024 px). */
export const TopoMobile: React.FC<TopoMobileProps> = ({ conexao, faixa, ...botoes }) => (
  <header className={`topo-mobile${faixa ? ' is-emergencia' : ''}`}>
    <div className="topo-mobile-barra">
      <span className="marca-simbolo is-pequeno" aria-hidden="true"><HeartPulse size={18} /></span>
      <span className="topo-mobile-nome">Amparo</span>
      <StatusConexao estado={conexao} curto />
      <BotoesTopo {...botoes} compacto />
    </div>
    <AnimatePresence initial={false}>
      {faixa && <motion.div key="faixa" className="topo-mobile-faixa" {...FAIXA}>{faixa}</motion.div>}
    </AnimatePresence>
  </header>
);

/** Barra inferior fixa com as 4 abas (< 1024 px). */
export const BarraInferior: React.FC<{ view: AppView; onSelecionar: (tab: AppTab) => void }> = ({ view, onSelecionar }) => (
  <nav className="barra-inferior" aria-label="Navegação principal">
    {ABAS.map(({ id, rotulo, Icone }) => (
      <button key={id} className={`barra-inferior-aba${view === id ? ' is-ativo' : ''}`}
        aria-current={view === id ? 'page' : undefined} onClick={() => onSelecionar(id)}>
        <span className="barra-inferior-indicador">
          {view === id && <motion.span layoutId="barra-inferior-ativa" className="barra-inferior-fundo" transition={DESLIZE} aria-hidden="true" />}
          <Icone size={20} aria-hidden="true" />
        </span>
        {rotulo}
      </button>
    ))}
  </nav>
);
