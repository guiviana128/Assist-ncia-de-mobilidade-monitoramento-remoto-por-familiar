import React, { useRef, useState } from 'react';
import { useLargura } from '../../hooks/useLargura';
import { formatarNumero, META_PASSOS, type Barra } from '../../lib/historico';
import { Flip, gsap, movimentoReduzido, useGSAP } from '../../motion/gsap';
import { DUR, EASE_GSAP, SEM_REDUCAO } from '../../motion/tokens';

interface GraficoPassosProps {
  barras: Barra[];
  /** Mostra a linha da meta diária (some na vista "Hoje", que é por hora). */
  meta?: number | null;
  altura?: number;
  curto?: boolean;
  titulo: string;
  /** Barras crescem de baixo para cima (stagger 40 ms). O Monitorar liga só na primeira vez da sessão. */
  animarEntrada?: boolean;
  /** Muda quando o período muda: as barras se reorganizam com Flip (450 ms). */
  chave?: string;
}

/** Identidade de cada barra entre períodos (o mesmo dia é a mesma barra em 7 e em 30 dias). */
const idBarra = (b: Barra, i: number) => (b.hoje ? 'hoje' : b.data ? b.data.toDateString() : `b${i}`);
const BARRA = '.grafico-barra-forma';

const ESQ = 56;           // espaço do eixo y
const BASE_ROTULO = 28;   // espaço dos rótulos do eixo x

/** Passos por dia em SVG próprio: meta tracejada, barra de hoje destacada (Figma 21:1087). */
export const GraficoPassos: React.FC<GraficoPassosProps> = ({ barras, meta = META_PASSOS, altura = 260, curto, titulo, animarEntrada, chave }) => {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativa, setAtiva] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const chaveAntes = useRef(chave);
  const flipBarras = useRef<Flip.FlipState | 'fade' | null>(null);
  const entrou = useRef(false);

  // Troca de período: guarda onde cada barra estava antes de o React redesenhar (Flip)
  if (chaveAntes.current !== chave) {
    chaveAntes.current = chave;
    flipBarras.current = !svg.current ? null : movimentoReduzido() ? 'fade' : Flip.getState(svg.current.querySelectorAll(BARRA));
  }

  useGSAP(() => {
    const estado = flipBarras.current;
    flipBarras.current = null;
    const rotuloHoje = '.grafico-valor.is-hoje .grafico-valor-conteudo';
    if (estado === 'fade') {
      gsap.from([BARRA, rotuloHoje], { opacity: 0, duration: DUR.curta });
    } else if (estado) {
      Flip.from(estado, {
        targets: BARRA, duration: DUR.longa, ease: EASE_GSAP, scale: true,
        onEnter: novas => gsap.from(novas, { scaleY: 0, transformOrigin: '50% 100%', duration: DUR.longa })
      });
      gsap.from(rotuloHoje, { opacity: 0, y: 4, duration: DUR.curta, delay: DUR.longa });
    } else if (animarEntrada && !entrou.current) {
      // Primeira vez na sessão: crescem de baixo para cima; o rótulo de hoje entra depois (fade + 4 px)
      entrou.current = true;
      const n = barras.length;
      const mm = gsap.matchMedia();
      mm.add(SEM_REDUCAO, () => {
        gsap.from(BARRA, { scaleY: 0, transformOrigin: '50% 100%', duration: DUR.longa, stagger: 0.04 });
        gsap.from(rotuloHoje, { opacity: 0, y: 4, duration: DUR.curta, delay: DUR.longa + 0.04 * (n - 1) });
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.from([BARRA, rotuloHoje], { opacity: 0, duration: DUR.media });
      });
      // Se o efeito for desfeito antes de terminar (StrictMode monta duas vezes), a próxima montagem anima de novo
      return () => { entrou.current = false; mm.revert(); };
    }
    return undefined;
  }, { scope: svg, dependencies: [chave] });
  const esq = curto ? 0 : ESQ;
  const topo = 12;
  const h = altura - BASE_ROTULO - topo;
  const max = Math.max(2000, Math.ceil(Math.max(...barras.map(b => b.valor), meta ?? 0) / 500) * 500);
  const y = (v: number) => topo + h - (v / max) * h;
  const passo = (largura - esq) / barras.length;
  const larguraBarra = Math.min(56, Math.max(6, passo * (barras.length > 10 ? 0.62 : 0.44)));
  const cx = (i: number) => esq + passo * i + passo / 2;
  const marcas = [0, max / 2, max];
  const longo = barras.length > 12;
  const rotuloDe = (b: Barra) => (curto ? b.rotuloCurto : longo ? b.numero ?? b.rotulo : b.rotulo);
  const mostrarRotulo = (i: number) => !longo || barras[i]!.hoje || (Number(barras[i]!.numero) % 5 === 0 && i < barras.length - 2);
  const opacidade = (b: Barra) => (b.hoje ? 1 : meta && b.valor >= meta ? 0.5 : 0.24);

  return (
    <div className="grafico" ref={ref}>
      <svg ref={svg} width={largura} height={altura} role="img" aria-label={titulo}>
        {!curto && marcas.map(m => (
          <g key={m}>
            <line className="grafico-grade" x1={esq} x2={largura} y1={y(m)} y2={y(m)} />
            <text className="grafico-eixo" x={esq - 12} y={y(m) + 4} textAnchor="end">{formatarNumero(m)}</text>
          </g>
        ))}
        {curto && <line className="grafico-grade" x1={0} x2={largura} y1={y(0)} y2={y(0)} />}
        {barras.map((b, i) => {
          const topoBarra = y(b.valor);
          const alt = Math.max(0, y(0) - topoBarra);
          const x = cx(i) - larguraBarra / 2;
          const raio = Math.min(barras.length > 10 ? 4 : 8, larguraBarra / 2, alt);
          return (
            <g key={idBarra(b, i)} className={`grafico-barra${b.hoje ? ' is-hoje' : ''}${ativa === i ? ' is-ativa' : ''}`}
              tabIndex={0} role="img" aria-label={`${b.hoje ? 'Hoje' : longo ? `Dia ${b.numero}` : b.rotulo}: ${formatarNumero(b.valor)} passos`}
              onMouseEnter={() => setAtiva(i)} onMouseLeave={() => setAtiva(null)} onFocus={() => setAtiva(i)} onBlur={() => setAtiva(null)}>
              {/* área de toque maior que a barra */}
              <rect x={cx(i) - passo / 2} y={topo} width={passo} height={h} fill="transparent" />
              {alt > 0 && <path d={`M${x},${y(0)} V${topoBarra + raio} Q${x},${topoBarra} ${x + raio},${topoBarra} H${x + larguraBarra - raio} Q${x + larguraBarra},${topoBarra} ${x + larguraBarra},${topoBarra + raio} V${y(0)} Z`}
                className="grafico-barra-forma" data-flip-id={idBarra(b, i)} style={{ opacity: opacidade(b) }} />}
              {mostrarRotulo(i) && (
                <text className={`grafico-eixo${b.hoje ? ' is-hoje' : ''}`} x={cx(i)} y={altura - 8} textAnchor="middle">{rotuloDe(b)}</text>
              )}
            </g>
          );
        })}
        {meta != null && <>
          <line className="grafico-meta" x1={esq} x2={largura} y1={y(meta)} y2={y(meta)} />
          <g transform={`translate(${esq + (curto ? 0 : 6)}, ${y(meta) - 22})`}>
            <rect className="grafico-meta-fundo" width={66} height={18} rx={6} />
            <text className="grafico-meta-rotulo" x={curto ? 0 : 6} y={13}>Meta {formatarNumero(meta)}</text>
          </g>
        </>}
        {barras.map((b, i) => (b.hoje || ativa === i) && b.valor > 0 ? (
          <g key={`v${i}`} transform={`translate(${Math.min(largura - 26, Math.max(26, cx(i)))}, ${Math.max(topo + 2, y(b.valor) - 12)})`} className={`grafico-valor${b.hoje ? ' is-hoje' : ''}`} aria-hidden="true">
            {/* grupo interno: o GSAP anima este, sem mexer no translate do externo */}
            <g className="grafico-valor-conteudo">
              <rect x={-26} y={-12} width={52} height={22} rx={6} />
              <text y={4} textAnchor="middle">{formatarNumero(b.valor)}</text>
            </g>
          </g>
        ) : null)}
      </svg>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead><tr><th>Dia</th><th>Passos</th></tr></thead>
        <tbody>{barras.map((b, i) => <tr key={i}><td>{b.hoje ? 'Hoje' : longo ? `dia ${b.numero}` : b.rotulo}</td><td>{formatarNumero(b.valor)}</td></tr>)}</tbody>
      </table>
    </div>
  );
};

/** Tremor em Hz com a faixa de atenção de 3 a 7 Hz (Figma 21:1157). */
export const GraficoTremor: React.FC<{ valores: number[]; inicio: string }> = ({ valores, inicio }) => {
  const [ref, largura] = useLargura<HTMLDivElement>(340);
  const svg = useRef<SVGSVGElement>(null);

  // A linha se desenha da esquerda para a direita (DrawSVG, 600 ms) ao abrir e ao trocar de período
  useGSAP(() => {
    if (movimentoReduzido()) return;
    gsap.fromTo('.grafico-linha', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, ease: 'power1.inOut', clearProps: 'strokeDasharray,strokeDashoffset' });
  }, { scope: svg, dependencies: [inicio] });

  // O ponto "agora" pulsa devagar (2,4 s); reinicia se o ponto mudar de lugar
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(SEM_REDUCAO, () => {
      gsap.fromTo('.grafico-agora-pulso', { scale: 1, opacity: 0.4, transformOrigin: '50% 50%' }, { scale: 2.8, opacity: 0, duration: 2.4, ease: 'sine.out', repeat: -1 });
    });
    return () => mm.revert();
  }, { scope: svg, dependencies: [largura, inicio], revertOnUpdate: true });
  const altura = 172;
  const base = 150;
  const porHz = base / 8;
  const y = (hz: number) => base - hz * porHz;
  const x = (i: number) => 4 + (i / Math.max(1, valores.length - 1)) * (largura - 10);
  const linha = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ultimo = valores[valores.length - 1] ?? 0;
  return (
    <div className="grafico" ref={ref}>
      <svg ref={svg} width={largura} height={altura} role="img"
        aria-label={`Tremor no período: entre ${Math.min(...valores).toFixed(1)} e ${Math.max(...valores).toFixed(1)} Hz. Faixa de atenção de 3 a 7 Hz.`}>
        <rect className="grafico-faixa" x={0} y={y(7)} width={largura} height={y(3) - y(7)} rx={8} />
        <text className="grafico-faixa-rotulo" x={10} y={y(7) + 19}>Faixa de atenção · 3 a 7 Hz</text>
        <line className="grafico-grade" x1={0} x2={largura} y1={base} y2={base} />
        <path className="grafico-linha" d={linha} />
        <circle className="grafico-agora-pulso" cx={x(valores.length - 1)} cy={y(ultimo)} r={5} />
        <circle className="grafico-agora" cx={x(valores.length - 1)} cy={y(ultimo)} r={5} />
        <text className="grafico-eixo" x={0} y={base + 18}>{inicio}</text>
        <text className="grafico-eixo is-hoje" x={largura} y={base + 18} textAnchor="end">hoje</text>
      </svg>
    </div>
  );
};
