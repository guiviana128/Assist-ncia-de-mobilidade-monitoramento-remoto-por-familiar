import React from 'react';
import { Bot } from 'lucide-react';
import type { HouseLayout, Point2D, Room } from '../../types/robot';

/*
 * Planta 2D da casa (Figma: painel "Casa agora"). Fonte dos cômodos: robot/houseLayout.ts.
 * Escala de 70 px por metro, como no Figma; o SVG se adapta à largura do painel.
 * Eixo y do mapa cresce para cima (Quarto em cima, Sala embaixo), por isso a inversão em py().
 */

export type EstadoComodo = { titulo: string; tom?: 'pessoa' | 'perigo' | 'neutro' };

interface PlantaCasaProps {
  layout: HouseLayout;
  /** Cômodo onde o José está. */
  comodoPessoa?: string | null;
  /** Posição do robô em metros. */
  robo?: Point2D | null;
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

export const PlantaCasa: React.FC<PlantaCasaProps> = ({ layout, comodoPessoa, robo, rota, emergencia, estados, onComodo, decorativa, className }) => {
  const xs = layout.rooms.flatMap(r => [r.minX, r.maxX]);
  const ys = layout.rooms.flatMap(r => [r.minY, r.maxY]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const px = (x: number) => MARGEM + (x - minX) * PX;
  const py = (y: number) => MARGEM + (maxY - y) * PX;
  const largura = (maxX - minX) * PX + MARGEM * 2;
  const altura = (maxY - minY) * PX + MARGEM * 2;
  const pessoaRoom = layout.rooms.find(r => r.id === comodoPessoa);
  const corRota = emergencia ? 'var(--perigo)' : 'var(--acento)';

  return (
    <svg className={`planta${emergencia ? ' is-emergencia' : ''} ${className ?? ''}`} viewBox={`0 0 ${largura} ${altura}`}
      role={decorativa ? undefined : 'group'} aria-hidden={decorativa || undefined}
      aria-label={decorativa ? undefined : 'Planta da casa'} preserveAspectRatio="xMidYMid meet">
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
            onClick={interativo ? () => onComodo!(room) : undefined}
            onKeyDown={interativo ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onComodo!(room); } } : undefined}>
            <rect className="planta-piso" x={x} y={y} width={w} height={h} />
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
      {rota && rota.length > 1 && <>
        <polyline className="planta-rota" points={rota.map(p => `${px(p.x)},${py(p.y)}`).join(' ')} stroke={corRota} />
        <circle className="planta-destino" cx={px(rota[rota.length - 1]!.x)} cy={py(rota[rota.length - 1]!.y)} r={7} stroke={corRota} />
      </>}

      {/* José */}
      {pessoaRoom && (() => {
        const cx = px(pessoaRoom.targetX), cy = py(pessoaRoom.targetY);
        return (
          <g className={`marcador-pessoa${emergencia ? ' is-alerta' : ''}`} aria-hidden="true">
            <circle className="marcador-pessoa-pulso2" cx={cx} cy={cy} r={46} />
            <circle className="marcador-pessoa-pulso1" cx={cx} cy={cy} r={33} />
            <circle className="marcador-pessoa-pino" cx={cx} cy={cy} r={18.5} />
            <text className="marcador-pessoa-letra" x={cx} y={cy + 6}>J</text>
          </g>
        );
      })()}

      {/* Robô */}
      {robo && (() => {
        const cx = px(robo.x), cy = py(robo.y);
        return (
          <g className={`marcador-robo${emergencia ? ' is-socorro' : ''}`} aria-hidden="true">
            <circle className="marcador-robo-halo" cx={cx} cy={cy} r={24} />
            <rect className="marcador-robo-corpo" x={cx - 17} y={cy - 17} width={34} height={34} rx={11} />
            <Bot x={cx - 9} y={cy - 9} width={18} height={18} color="#fff" strokeWidth={2} />
          </g>
        );
      })()}
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
  const colunas = [...new Set(layout.rooms.flatMap(r => [r.minX, r.maxX]))].sort((a, b) => a - b);
  const linhas = [...new Set(layout.rooms.flatMap(r => [r.minY, r.maxY]))].sort((a, b) => b - a);
  const larguras = colunas.slice(1).map((c, i) => `${(c - colunas[i]!).toFixed(2)}fr`).join(' ');

  return (
    <div className={`planta-simples${emergencia ? ' is-emergencia' : ''}`} style={{ gridTemplateColumns: larguras }}
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
          {comPessoa && <span className={`planta-simples-pessoa${emergencia ? ' is-alerta' : ''}`} aria-hidden="true">J</span>}
          {room.id === comodoRobo && <span className={`planta-simples-robo${emergencia ? ' is-socorro' : ''}`} aria-hidden="true"><Bot size={14} /></span>}
        </>;
        const classe = `planta-simples-comodo${comPessoa ? ' is-pessoa' : ''}`;
        return decorativa || !onComodo
          ? <div key={room.id} className={classe} style={estilo}>{conteudo}</div>
          : <button key={room.id} className={classe} style={estilo} onClick={() => onComodo(room)}
              aria-label={`${room.name}${estado ? `, ${estado.titulo}` : ''}. Abrir na Casa 3D`}>{conteudo}</button>;
      })}
    </div>
  );
};
