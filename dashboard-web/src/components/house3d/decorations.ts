import type { Furniture, HouseLayout, Point2D, Room } from '../../types/robot';
import { DOORS, planPath } from '../../robot/houseLayout';

export interface VisualFurniture extends Furniture { yaw?: number }

type Decoration = Pick<Furniture, 'name' | 'sizeX' | 'sizeY' | 'height'>;
const extras: Record<string, Decoration[]> = {
  quarto: [
    { name: 'Guarda-roupa', sizeX: 1.1, sizeY: 0.45, height: 1.65 },
    { name: 'Criado-mudo', sizeX: 0.35, sizeY: 0.35, height: 0.48 }
  ],
  banheiro: [
    { name: 'Chuveiro', sizeX: 0.7, sizeY: 0.7, height: 1.8 },
    { name: 'Vaso sanitário', sizeX: 0.42, sizeY: 0.64, height: 0.65 }
  ],
  cozinha: [
    { name: 'Geladeira', sizeX: 0.62, sizeY: 0.6, height: 1.65 },
    { name: 'Fogão', sizeX: 0.55, sizeY: 0.55, height: 0.85 },
    { name: 'Armário', sizeX: 0.8, sizeY: 0.4, height: 1.25 }
  ],
  sala: [
    { name: 'Mesa lateral', sizeX: 0.45, sizeY: 0.45, height: 0.52 },
    { name: 'Planta', sizeX: 0.3, sizeY: 0.3, height: 0.5 }
  ],
  escritorio: [{ name: 'Armário', sizeX: 0.7, sizeY: 0.35, height: 1.35 }],
  servico: [{ name: 'Armário', sizeX: 0.65, sizeY: 0.4, height: 1.1 }]
};

function overlaps(a: Furniture, b: Furniture, gap = 0.08) {
  return Math.abs(a.x - b.x) < (a.sizeX + b.sizeX) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.sizeY + b.sizeY) / 2 + gap;
}

/** Interseção exata de segmento com retângulo expandido pela folga de circulação. */
function intersectsRoute(f: Furniture, a: Point2D, b: Point2D) {
  let start = 0;
  let end = 1;
  for (const [origin, delta, center, size] of [
    [a.x, b.x - a.x, f.x, f.sizeX],
    [a.y, b.y - a.y, f.y, f.sizeY]
  ]) {
    const min = center - size / 2 - 0.25;
    const max = center + size / 2 + 0.25;
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
    } else {
      const first = (min - origin) / delta;
      const last = (max - origin) / delta;
      start = Math.max(start, Math.min(first, last));
      end = Math.min(end, Math.max(first, last));
      if (start > end) return false;
    }
  }
  return true;
}

function candidates(room: Room, item: Decoration): Furniture[] {
  const points: Furniture[] = [];
  for (const rotate of [false, true]) {
    const sizeX = rotate ? item.sizeY : item.sizeX;
    const sizeY = rotate ? item.sizeX : item.sizeY;
    const minX = room.minX + sizeX / 2 + 0.12;
    const maxX = room.maxX - sizeX / 2 - 0.12;
    const minY = room.minY + sizeY / 2 + 0.12;
    const maxY = room.maxY - sizeY / 2 - 0.12;
    if (minX > maxX || minY > maxY) continue;
    const add = (x: number, y: number) => points.push({ ...item, roomId: room.id, sizeX, sizeY, x, y });
    for (let x = minX; x <= maxX + 0.001; x += 0.15) { add(x, maxY); add(x, minY); }
    for (let y = minY; y <= maxY + 0.001; y += 0.15) { add(minX, y); add(maxX, y); }
  }
  return points;
}

/** Apenas decoração: não modifica os dados de colisão, o mapa nem a navegação. */
export function roomDecorations(layout: HouseLayout): VisualFurniture[] {
  const destinations = [layout.dock, ...layout.rooms.map(r => ({ x: r.targetX, y: r.targetY }))];
  const routes: [Point2D, Point2D][] = [];
  destinations.forEach((from, index) => destinations.slice(index + 1).forEach(to => {
    const path = planPath(layout, from, to);
    path.slice(1).forEach((point, i) => routes.push([path[i], point]));
  }));
  const reserved: Furniture[] = [
    ...layout.furniture,
    ...(layout.doors ?? DOORS).map(p => ({ ...p, name: 'Porta', roomId: '', sizeX: 1.1, sizeY: 1.1, height: 0 })),
    ...layout.rooms.map(r => ({
      name: 'Pessoa', roomId: r.id,
      x: Math.min(r.maxX - 0.4, r.targetX + 0.55),
      y: Math.min(r.maxY - 0.4, r.targetY + 0.35),
      sizeX: 0.7, sizeY: 0.7, height: 0
    }))
  ];
  const result: VisualFurniture[] = [];
  // Cadeiras voltadas à mesa, parcialmente recolhidas sob o tampo.
  for (const table of layout.furniture.filter(f => /escrivaninha/i.test(f.name))) {
    const room = layout.rooms.find(r => r.id === table.roomId);
    if (!room) continue;
    const options = [
      { x: table.x, y: table.y - table.sizeY / 2 - 0.1, yaw: Math.PI },
      { x: table.x, y: table.y + table.sizeY / 2 + 0.1, yaw: 0 },
      { x: table.x - table.sizeX / 2 - 0.1, y: table.y, yaw: Math.PI / 2 },
      { x: table.x + table.sizeX / 2 + 0.1, y: table.y, yaw: -Math.PI / 2 }
    ];
    let count = 0;
    for (const option of options) {
      const chair: VisualFurniture = { ...option, name: 'Cadeira', roomId: room.id, sizeX: 0.42, sizeY: 0.42, height: 0.9 };
      const inside = chair.x - 0.21 > room.minX + 0.08 && chair.x + 0.21 < room.maxX - 0.08 &&
        chair.y - 0.21 > room.minY + 0.08 && chair.y + 0.21 < room.maxY - 0.08;
      if (inside && !reserved.some(other => other !== table && overlaps(chair, other)) &&
          !routes.some(([a, b]) => intersectsRoute(chair, a, b))) {
        result.push(chair);
        reserved.push(chair);
        count++;
      }
      if (count === (/escrivaninha/i.test(table.name) ? 1 : 2)) break;
    }
  }
  for (const room of layout.rooms) {
    const kind = room.id.replace(/-\d+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const items = extras[kind] ?? [{ name: 'Planta', sizeX: 0.28, sizeY: 0.28, height: 0.45 }];
    for (const item of items) {
      if (layout.furniture.some(f => f.roomId === room.id && f.name === item.name)) continue;
      const position = candidates(room, item).find(f =>
        !reserved.some(other => overlaps(f, other)) && !routes.some(([a, b]) => intersectsRoute(f, a, b))
      );
      if (position) {
        result.push(position);
        reserved.push(position);
      }
    }
  }
  return result;
}
