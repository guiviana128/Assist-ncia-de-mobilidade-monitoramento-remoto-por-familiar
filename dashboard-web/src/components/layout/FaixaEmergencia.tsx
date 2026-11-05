import React, { useRef } from 'react';
import { Box, Phone, TriangleAlert } from 'lucide-react';
import { gsap, movimentoReduzido, useGSAP } from '../../motion/gsap';
import { DESLOCA, DUR, QUEDA } from '../../motion/tokens';

interface FaixaEmergenciaProps {
  titulo: string;
  detalhe: string;
  demo: boolean;
  /** No celular a faixa é compacta e as ações ficam na tela (Início). */
  compacta?: boolean;
  onVerCasa: () => void;
}

/** Faixa vermelha logo abaixo da navegação quando há socorro pendente (Navbar · Emergência). */
export const FaixaEmergencia: React.FC<FaixaEmergenciaProps> = ({ titulo, detalhe, demo, compacta, onVerCasa }) => {
  const ref = useRef<HTMLDivElement>(null);
  // Os botões entram de cima para baixo depois que a faixa desce (stagger 60 ms)
  useGSAP(() => {
    gsap.from('.faixa-emergencia-acoes > *', movimentoReduzido()
      ? { opacity: 0, duration: DUR.curta, stagger: QUEDA.stagger, delay: QUEDA.botoes }
      : { opacity: 0, y: -DESLOCA, duration: DUR.curta, stagger: QUEDA.stagger, delay: QUEDA.botoes });
  }, { scope: ref });
  return (
  <div ref={ref} className={`faixa-emergencia${compacta ? ' is-compacta' : ''}`} role="alert">
    <TriangleAlert size={compacta ? 18 : 20} aria-hidden="true" />
    <p className="faixa-emergencia-texto">
      <strong>{titulo}</strong> <span>{detalhe}</span>
    </p>
    {!compacta && (
      <div className="faixa-emergencia-acoes">
        <button className="btn btn-secundario" onClick={onVerCasa}><Box size={20} />Ver na casa 3D</button>
        {demo
          ? <span className="btn btn-perigo" aria-disabled="true" title="Simulação: nenhuma ligação é feita no modo demonstração"><Phone size={20} />Ligar SAMU 192</span>
          : <a className="btn btn-perigo" href="tel:192"><Phone size={20} />Ligar SAMU 192</a>}
      </div>
    )}
  </div>
  );
};
