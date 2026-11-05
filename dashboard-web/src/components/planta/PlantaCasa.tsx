import React, { useId, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import type { HouseLayout, Point2D, Room } from '../../types/robot';
import { gsap, movimentoReduzido, useGSAP } from '../../motion/gsap';
import { usePulso } from '../../motion/usePulso';
import { zoomCasa } from '../../motion/zoomCasa';
import { DUR, QUEDA, ROBO_INTERPOLA } from '../../motion/tokens';

/*
 * Planta 2D da casa (Figma: painel "Casa agora"). Fonte dos cômodos: robot/houseLayout.ts.
 * Escala de 70 px por metro, como no Figma; o SVG se adapta à largura do painel.
 * Eixo y do mapa cresce para cima (Quarto em cima, Sala embaixo), por isso a inversão em py().
 *
 * Animações (Figma 14:987): pulsos do José, robô interpolado entre leituras (900 ms, linear) com
 * pulso único do halo ao chegar num cômodo, rota que se desenha à frente dele e, na queda,
 * o cômodo fica vermelho numa onda que sai do pino.
 */

export type EstadoComodo = { titulo: string; tom?: 'pessoa' | 'perigo' | 'neutro' };

interface PlantaCasaProps {
  layout: HouseLayout;
  /** Cômodo onde o José está. */
  comodoPessoa?: string | null;
  /** Posição do robô em metros. */
  robo?: Point2D | null;
  /** Cômodo atual do robô (o halo pulsa uma vez quando ele chega a outro). */
  comodoRobo?: string | null;
  /** Rota prevista do robô (inclui a posição atual e o destino). */
  rota?: Point2D[];
  emergencia?: boolean;
  /** Texto abaixo do nome de cada cômodo. */
  estados?: Record<string, EstadoComodo>;
  onComodo?: (room: Room) => void;
  /** Ilustração sem interação (tela de login). */
  decorativa?: boolean;
  className?: string;
}

const PX = 70;
const MARGEM = 20;
const PAREDE = 6;

export const PlantaCasa: React.FC<PlantaCasaProps> = ({ layout, comodoPessoa, robo, comodoRobo, rota, emergencia, estados, onComodo, decorativa, className }) => {
  const svg = useRef<SVGSVGElement>(null);
  const roboRef = useRef<SVGGElement>(null);
  const roboAntes = useRef<{ x: number; y: number } | null>(null);
  const comodoRoboAntes = useRef<string | null | undefined>(undefined);
  const destinoAntes = useRef<string | null | undefined>(undefined);
  const emergenciaAntes = useRef<boolean | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const ids = useId().replace(/:/g, '');

  const xs = layout.rooms.flatMap(r => [r.minX, r.maxX]);
  const ys = layout.rooms.flatMap(r => [r.minY, r.maxY]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const px = (x: number) => MARGEM + (x - minX) * PX;
  const py = (y: number) => MARGEM + (maxY - y) * PX;
  const largura = (maxX - minX) * PX + MARGEM * 2;
  const altura = (maxY - minY) * PX + MARGEM * 2;
  const pessoaRoom = layout.rooms.find(r => r.id === comodoPessoa);
  const corRota = emergencia ? 'var(--perigo)' : 'var(--acento)';
  const temRota = !!rota && rota.length > 1;
  const pontosRota = temRota ? rota!.map(p => `${px(p.x)},${py(p.y)}`).join(' ') : '';
  const fimRota = temRota ? rota![rota!.length - 1]! : null;
  const chaveDestino = fimRota ? `${fimRota.x.toFixed(2)},${fimRota.y.toFixed(2)}` : null;

  // Pino do José: centro e raio da onda (até o canto mais distante do cômodo)
  const pino = pessoaRoom ? { x: px(pessoaRoom.targetX), y: py(pessoaRoom.targetY) } : null;
  const raioOnda = pessoaRoom && pino
    ? Math.max(...[[pessoaRoom.minX, pessoaRoom.minY], [pessoaRoom.minX, pessoaRoom.maxY], [pessoaRoom.maxX, pessoaRoom.minY], [pessoaRoom.maxX, pessoaRoom.maxY]]
        .map(([x, y]) => Math.hypot(px(x!) - pino.x, py(y!) - pino.y))) + 4
    : 0;

  // ---- José vivo na tela: pulsos (reinicia se o pino mudar de lugar)
  usePulso(svg, !!emergencia, `${comodoPessoa}`);

  // ---- Robô: posição interpolada entre as leituras da API (900 ms, linear), sem saltos
  useGSAP(() => {
    const g = roboRef.current;
    if (!g || !robo) { roboAntes.current = null; return; }
    const alvo = { x: px(robo.x), y: py(robo.y) };
    if (!roboAntes.current || decorativa || movimentoReduzido()) gsap.set(g, alvo);
    else gsap.to(g, { ...alvo, duration: ROBO_INTERPOLA, ease: 'none', overwrite: 'auto' });
    roboAntes.current = alvo;
  }, { scope: svg, dependencies: [robo?.x, robo?.y, robo ? 1 : 0, largura, altura] });

  // ---- Halo: um pulso único quando o robô chega a outro cômodo
  useGSAP(() => {
    const antes = comodoRoboAntes.current;
    comodoRoboAntes.current = comodoRobo;
    if (antes === undefined || !comodoRobo || antes === comodoRobo || movimentoReduzido()) return;
    gsap.timeline()
      .to('.marcador-robo-halo', { scale: 1.6, opacity: 0.3, transformOrigin: '50% 50%', duration: DUR.media })
      .to('.marcador-robo-halo', { scale: 1, opacity: 0.16, duration: DUR.longa });
  }, { scope: svg, dependencies: [comodoRobo] });

  // ---- Rota: desenha-se à frente do robô quando o destino muda (DrawSVG numa máscara, porque a rota é tracejada)
  useGSAP(() => {
    const antes = destinoAntes.current;
    destinoAntes.current = chaveDestino;
    if (antes === undefined || !chaveDestino || antes === chaveDestino) return; // ao abrir a tela, a rota aparece pronta
    if (movimentoReduzido() || decorativa) return;
    gsap.fromTo('.planta-rota-mascara', { drawSVG: '0%' }, {
      drawSVG: '100%', duration: 0.6, ease: 'power1.inOut', clearProps: 'strokeDasharray,strokeDashoffset'
    });
  }, { scope: svg, dependencies: [chaveDestino] });

  // ---- Queda: o cômodo fica vermelho numa onda que sai do pino (clip-path circular crescendo, 600 ms).
  // Volta ao normal: o inverso em 60% do tempo. Com movimento reduzido, só a opacidade.
  useGSAP(() => {
    const antes = emergenciaAntes.current;
    emergenciaAntes.current = !!emergencia;
    const onda = '.planta-onda-circulo';
    const camada = '.planta-onda';
    if (!pino) return;
    const ligado = !!emergencia;
    gsap.set(onda, { svgOrigin: `${pino.x} ${pino.y}` });
    if (antes === null || antes === ligado) {
      // primeira pintura (ou só mudou o cômodo): estado final, sem animação
      gsap.set(onda, { scale: ligado ? 1 : 0 });
      gsap.set(camada, { opacity: ligado ? 1 : 0 });
      return;
    }
    if (movimentoReduzido()) {
      gsap.set(onda, { scale: 1 });
      gsap.to(camada, { opacity: ligado ? 1 : 0, duration: ligado ? DUR.media : DUR.media * QUEDA.volta, delay: ligado ? QUEDA.onda : 0, overwrite: true });
      return;
    }
    gsap.set(camada, { opacity: 1 });
    if (ligado) gsap.fromTo(onda, { scale: 0 }, { scale: 1, duration: QUEDA.duracaoOnda, delay: QUEDA.onda, overwrite: true });
    else gsap.to(onda, { scale: 0, duration: QUEDA.duracaoOnda * QUEDA.volta, ease: 'power2.in', overwrite: true });
  }, { scope: svg, dependencies: [emergencia, comodoPessoa, largura] });

  const abrir = (room: Room, el: Element) => { zoomCasa.guardar(el); onComodo!(room); };

  return (
    <svg ref={svg} className={`planta${emergencia ? ' is-emergencia' : ''} ${className ?? ''}`} viewBox={`0 0 ${largura} ${altura}`}
      role={decorativa ? undefined : 'group'} aria-hidden={decorativa || undefined}
      aria-label={decorativa ? undefined : 'Planta da casa'} preserveAspectRatio="xMidYMid meet">
      <defs>
        {pino && <clipPath id={`onda-${ids}`}><circle className="planta-onda-circulo" cx={pino.x} cy={pino.y} r={raioOnda} /></clipPath>}
        {temRota && (
          <mask id={`rota-${ids}`} maskUnits="userSpaceOnUse" x={0} y={0} width={largura} height={altura}>
            <polyline className="planta-rota-mascara" points={pontosRota} />
          </mask>
        )}
      </defs>

      {/* Cômodos */}
      {layout.rooms.map(room => {
        const estado = estados?.[room.id];
        const comPessoa = room.id === comodoPessoa;
        const x = px(room.minX), y = py(room.maxY), w = (room.maxX - room.minX) * PX, h = (room.maxY - room.minY) * PX;
        const interativo = !decorativa && !!onComodo;
        return (
          <g key={room.id} className={`planta-comodo${comPessoa ? ' is-pessoa' : ''}`}
            role={interativo ? 'button' : undefined} tabIndex={interativo ? 0 : undefined}
            aria-label={interativo ? `${room.name}${estado ? `, ${estado.titulo}` : ''}. Abrir na Casa 3D` : undefined}
            onClick={interativo ? e => abrir(room, e.currentTarget) : undefined}
            onPointerEnter={interativo ? () => setSobre(room.id) : undefined}
            onPointerLeave={interativo ? () => setSobre(s => (s === room.id ? null : s)) : undefined}
            onKeyDown={interativo ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(room, e.currentTarget); } } : undefined}>
            <rect className="planta-piso" x={x} y={y} width={w} height={h} />
            {comPessoa && pino && (
              <rect className="planta-onda" x={x} y={y} width={w} height={h} clipPath={`url(#onda-${ids})`} />
            )}
          </g>
        );
      })}

      {/* Móveis */}
      {layout.furniture.map((f, i) => {
        const w = f.sizeX * PX, h = f.sizeY * PX;
        // (x, y) do layout é o centro do móvel
        return <rect key={i} className="planta-movel" x={px(f.x) - w / 2} y={py(f.y) - h / 2} width={w} height={h} rx={6} />;
      })}

      {/* Paredes */}
      {layout.walls.map((wall, i) => (
        <line key={i} className="planta-parede" x1={px(wall.x1)} y1={py(wall.y1)} x2={px(wall.x2)} y2={py(wall.y2)} strokeWidth={PAREDE} />
      ))}

      {/* Hover: borda azul de 2 px por dentro das paredes (150 ms) */}
      {!decorativa && onComodo && (
        <g className="planta-contornos" aria-hidden="true">
          {layout.rooms.map(room => {
            const inset = PAREDE / 2 + 1;
            return <rect key={room.id} className={`planta-contorno${sobre === room.id ? ' is-sobre' : ''}`}
              x={px(room.minX) + inset} y={py(room.maxY) + inset}
              width={(room.maxX - room.minX) * PX - inset * 2} height={(room.maxY - room.minY) * PX - inset * 2} rx={2} />;
          })}
        </g>
      )}

      {/* Rótulos (por cima dos móveis, sem capturar clique) */}
      <g className="planta-rotulos" aria-hidden="true">
        {layout.rooms.map(room => {
          const estado = estados?.[room.id];
          const x = px(room.minX), y = py(room.maxY);
          return (
            <g key={room.id} className={room.id === comodoPessoa ? 'is-pessoa' : undefined}>
              <text className="planta-nome" x={x + 16} y={y + 27}>{room.name}</text>
              {estado && <text className={`planta-estado is-${estado.tom ?? 'neutro'}`} x={x + 16} y={y + 44}>{estado.titulo}</text>}
            </g>
          );
        })}
      </g>

      {/* Rota do robô */}
      {temRota && fimRota && <>
        <polyline className="planta-rota" points={pontosRota} stroke={corRota} mask={`url(#rota-${ids})`} />
        <circle className="planta-destino" cx={px(fimRota.x)} cy={py(fimRota.y)} r={7} stroke={corRota} />
      </>}

      {/* José */}
      {pino && (
        <g className={`marcador-pessoa${emergencia ? ' is-alerta' : ''}`} aria-hidden="true">
          <circle className="marcador-pessoa-pulso2" data-pulso="2" cx={pino.x} cy={pino.y} r={46} />
          <circle className="marcador-pessoa-pulso1" data-pulso="1" cx={pino.x} cy={pino.y} r={33} />
          <circle className="marcador-pessoa-pino" cx={pino.x} cy={pino.y} r={18.5} />
          <text className="marcador-pessoa-letra" x={pino.x} y={pino.y + 6}>J</text>
        </g>
      )}

      {/* Robô: desenhado em (0, 0); o GSAP leva o grupo até a posição */}
      {robo && (
        <g ref={roboRef} className={`marcador-robo${emergencia ? ' is-socorro' : ''}`} aria-hidden="true">
          <circle className="marcador-robo-halo" cx={0} cy={0} r={24} />
          <rect className="marcador-robo-corpo" x={-17} y={-17} width={34} height={34} rx={11} />
          <Bot x={-9} y={-9} width={18} height={18} color="#fff" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
};

interface PlantaSimplificadaProps {
  layout: HouseLayout;
  comodoPessoa?: string | null;
  comodoRobo?: string | null;
  emergencia?: boolean;
  estados?: Record<string, EstadoComodo>;
  onComodo?: (room: Room) => void;
  decorativa?: boolean;
}

/** Nome curto para caber no cartão do celular. */
const nomeCurto = (room: Room) => (room.id === 'sala' ? 'Sala' : room.name);

/**
 * Planta simplificada do celular: os cômodos viram cartões numa grade que respeita
 * a posição real (colunas e linhas calculadas das bordas dos cômodos), com nomes legíveis.
 */
export const PlantaSimplificada: React.FC<PlantaSimplificadaProps> = ({ layout, comodoPessoa, comodoRobo, emergencia, estados, onComodo, decorativa }) => {
  const grade = useRef<HTMLDivElement>(null);
  usePulso(grade, !!emergencia, `${comodoPessoa}`);
  const colunas = [...new Set(layout.rooms.flatMap(r => [r.minX, r.maxX]))].sort((a, b) => a - b);
  const linhas = [...new Set(layout.rooms.flatMap(r => [r.minY, r.maxY]))].sort((a, b) => b - a);
  // min-content evita quebrar nomes como "Escritório" no meio em telas estreitas
  const larguras = colunas.slice(1).map((c, i) => `minmax(min-content, ${(c - colunas[i]!).toFixed(2)}fr)`).join(' ');

  return (
    <div ref={grade} className={`planta-simples${emergencia ? ' is-emergencia' : ''}`} style={{ gridTemplateColumns: larguras }}
      aria-hidden={decorativa || undefined} role={decorativa ? undefined : 'group'} aria-label={decorativa ? undefined : 'Planta da casa'}>
      {layout.rooms.map(room => {
        const estilo: React.CSSProperties = {
          gridColumn: `${colunas.indexOf(room.minX) + 1} / ${colunas.indexOf(room.maxX) + 1}`,
          gridRow: `${linhas.indexOf(room.maxY) + 1} / ${linhas.indexOf(room.minY) + 1}`
        };
        const comPessoa = room.id === comodoPessoa;
        const estado = estados?.[room.id];
        const conteudo = <>
          <span className="planta-simples-nome">{nomeCurto(room)}</span>
          {estado && <span className={`planta-simples-estado is-${estado.tom ?? 'neutro'}`}>{estado.titulo}</span>}
          {comPessoa && (
            <span className={`planta-simples-pessoa${emergencia ? ' is-alerta' : ''}`} aria-hidden="true">
              <span className="planta-simples-pulso is-2" data-pulso="2" /><span className="planta-simples-pulso is-1" data-pulso="1" />J
            </span>
          )}
          {room.id === comodoRobo && <span className={`planta-simples-robo${emergencia ? ' is-socorro' : ''}`} aria-hidden="true"><Bot size={14} /></span>}
        </>;
        const classe = `planta-simples-comodo${comPessoa ? ' is-pessoa' : ''}`;
        return decorativa || !onComodo
          ? <div key={room.id} className={classe} style={estilo}>{conteudo}</div>
          : <button key={room.id} className={classe} style={estilo} onClick={e => { zoomCasa.guardar(e.currentTarget); onComodo(room); }}
              aria-label={`${room.name}${estado ? `, ${estado.titulo}` : ''}. Abrir na Casa 3D`}>{conteudo}</button>;
      })}
    </div>
  );
};
