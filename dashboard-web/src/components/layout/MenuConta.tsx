import React from 'react';
import { DoorOpen, FlaskConical, Moon, Settings } from 'lucide-react';

interface MenuContaProps {
  usuario: string | null;
  pessoa: string;
  emConfiguracoes: boolean;
  onConfiguracoes: () => void;
  onSimulador: () => void;
  onSair: () => void;
}

export const iniciais = (nome: string | null) =>
  (nome ?? 'Família').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || 'F';

const nomeExibicao = (usuario: string | null) =>
  usuario ? usuario.charAt(0).toUpperCase() + usuario.slice(1) : 'Família';

/** Conteúdo do menu do avatar (Figma 29:1757). Em popover no computador, folha inferior no celular. */
export const MenuConta: React.FC<MenuContaProps> = ({ usuario, pessoa, emConfiguracoes, onConfiguracoes, onSimulador, onSair }) => (
  <div className="menu-conta">
    <div className="menu-conta-quem">
      <span className="menu-conta-avatar" aria-hidden="true">{iniciais(usuario)}</span>
      <div>
        <p className="menu-conta-nome">{nomeExibicao(usuario)}</p>
        <p className="menu-conta-papel">Família · cuida do {pessoa}</p>
      </div>
    </div>
    <hr className="menu-conta-divisor" />
    <button className={`menu-conta-opcao${emConfiguracoes ? ' is-ativo' : ''}`} onClick={onConfiguracoes} data-autofoco>
      <Settings size={18} aria-hidden="true" />Configurações
    </button>
    <button className="menu-conta-opcao" onClick={onSimulador}>
      <FlaskConical size={18} aria-hidden="true" />Simulador da apresentação
    </button>
    {/* Tema escuro fica fora deste redesign: o controle existe, mas está desativado. */}
    <div className="menu-conta-opcao is-desativado" title="Tema escuro chega em uma próxima versão">
      <Moon size={18} aria-hidden="true" />
      <span id="rotulo-tema">Tema escuro</span>
      <button className="interruptor" role="switch" aria-checked="false" aria-labelledby="rotulo-tema" aria-disabled="true" disabled />
    </div>
    <hr className="menu-conta-divisor" />
    <button className="menu-conta-opcao is-perigo" onClick={onSair}>
      <DoorOpen size={18} aria-hidden="true" />Sair
    </button>
  </div>
);
