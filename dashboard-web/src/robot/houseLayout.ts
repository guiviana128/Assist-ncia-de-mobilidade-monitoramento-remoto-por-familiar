// Planta da casa: cópia local usada quando o backend está offline (modo demonstração).
// Fonte oficial: GET /api/v1/house/layout (HouseLayoutService.java). Os números são os mesmos.
import type { HouseLayout, Point2D, Room } from '../types/robot';

export const FALLBACK_LAYOUT: HouseLayout = {
  name: 'Casa Amparo 2050',
  width: 10,
  depth: 8,
  wallHeight: 1,
  dock: { x: 0, y: 0 },
  rooms: [
    { id: 'sala', name: 'Sala de estar', minX: -2, minY: -3, maxX: 3, maxY: 1, targetX: 1.5, targetY: -1.5 },
    { id: 'cozinha', name: 'Cozinha', minX: 3, minY: -3, maxX: 8, maxY: 1, targetX: 5.5, targetY: -1 },
    { id: 'quarto', name: 'Quarto', minX: -2, minY: 1, maxX: 3, maxY: 5, targetX: 0.6, targetY: 3 },
    { id: 'banheiro', name: 'Banheiro', minX: 3, minY: 1, maxX: 5.5, maxY: 5, targetX: 4.2, targetY: 3 },
    { id: 'escritorio', name: 'Escritório', minX: 5.5, minY: 1, maxX: 8, maxY: 5, targetX: 6.9, targetY: 3 }
  ],
  walls: [
    { x1: -2, y1: -3, x2: 8, y2: -3 }, { x1: 8, y1: -3, x2: 8, y2: 5 },
    { x1: 8, y1: 5, x2: -2, y2: 5 }, { x1: -2, y1: 5, x2: -2, y2: -3 },
    { x1: -2, y1: 1, x2: 0, y2: 1 }, { x1: 1.2, y1: 1, x2: 3, y2: 1 },
    { x1: 3, y1: 1, x2: 3.6, y2: 1 }, { x1: 4.8, y1: 1, x2: 6.4, y2: 1 },
    { x1: 7.6, y1: 1, x2: 8, y2: 1 },
    { x1: 3, y1: -3, x2: 3, y2: -1.6 }, { x1: 3, y1: -0.4, x2: 3, y2: 1 },
    { x1: 3, y1: 1, x2: 3, y2: 5 }, { x1: 5.5, y1: 1, x2: 5.5, y2: 5 }
  ],
  furniture: [
    { name: 'Sofá', roomId: 'sala', x: -1.2, y: -2.4, sizeX: 1.4, sizeY: 0.7, height: 0.8 },
    { name: 'Rack da TV', roomId: 'sala', x: -1, y: 0.7, sizeX: 1.4, sizeY: 0.4, height: 0.5 },
    { name: 'Mesa', roomId: 'cozinha', x: 6.6, y: -1.8, sizeX: 1.2, sizeY: 0.8, height: 0.75 },
    { name: 'Bancada', roomId: 'cozinha', x: 5.5, y: -2.7, sizeX: 2.6, sizeY: 0.5, height: 0.9 },
    { name: 'Cama', roomId: 'quarto', x: -0.8, y: 3.8, sizeX: 1.6, sizeY: 2, height: 0.5 },
    { name: 'Pia', roomId: 'banheiro', x: 4.9, y: 4.6, sizeX: 0.8, sizeY: 0.5, height: 0.85 },
    { name: 'Escrivaninha', roomId: 'escritorio', x: 7.3, y: 4.4, sizeX: 1.2, sizeY: 0.6, height: 0.75 }
  ],
  patrolRoute: ['quarto', 'sala', 'cozinha', 'banheiro', 'cozinha', 'escritorio', 'cozinha', 'sala']
};

/** Portas entre cômodos (meio do vão), usadas para desenhar a rota prevista no painel. */
export const DOORS: { a: string; b: string; x: number; y: number }[] = [
  { a: 'sala', b: 'quarto', x: 0.6, y: 1 },
  { a: 'sala', b: 'cozinha', x: 3, y: -1 },
  { a: 'cozinha', b: 'banheiro', x: 4.2, y: 1 },
  { a: 'cozinha', b: 'escritorio', x: 7, y: 1 }
];

export const findRoom = (layout: HouseLayout, id?: string | null): Room | undefined =>
  id ? layout.rooms.find(room => room.id === id.trim().toLowerCase()) : undefined;

export const roomAt = (layout: HouseLayout, p: Point2D): Room | undefined =>
  layout.rooms.find(r => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY);

export const roomName = (layout: HouseLayout, id?: string | null): string =>
  findRoom(layout, id)?.name ?? (id || '—');

/**
 * Rota aproximada cômodo a cômodo (busca em largura no grafo de portas).
 * O caminho real é calculado pelo Nav2; aqui é só a visualização prevista.
 */
export function planPath(layout: HouseLayout, from: Point2D, to: Point2D): Point2D[] {
  const start = roomAt(layout, from)?.id;
  const goal = roomAt(layout, to)?.id;
  if (!start || !goal || start === goal) return [from, to];

  const previous = new Map<string, { room: string; door: Point2D }>();
  const queue = [start];
  const visited = new Set([start]);
  while (queue.length) {
    const room = queue.shift()!;
    if (room === goal) break;
    for (const door of DOORS) {
      const next = door.a === room ? door.b : door.b === room ? door.a : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        previous.set(next, { room, door: { x: door.x, y: door.y } });
        queue.push(next);
      }
    }
  }
  if (!previous.has(goal)) return [from, to];

  const doors: Point2D[] = [];
  for (let room = goal; room !== start;) {
    const step = previous.get(room)!;
    doors.unshift(step.door);
    room = step.room;
  }
  return [from, ...doors, to];
}

export const pathLength = (path: Point2D[]): number =>
  path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
