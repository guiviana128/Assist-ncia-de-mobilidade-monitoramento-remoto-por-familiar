import type { HouseLayout, Point2D } from '../types/robot';
import { roomAt } from './houseLayout';
import { roomDecorations } from '../components/house3d/decorations';

// Inclui rodas e uma margem de segurança. Tapetes não bloqueiam a circulação.
export const ROBOT_CLEARANCE = 0.21;
const STEP = 0.08;
const cache = new WeakMap<HouseLayout, ReturnType<typeof buildMap>>();
function buildMap(layout: HouseLayout) {
  const furniture = [...layout.furniture, ...roomDecorations(layout)].filter(f => f.height > 0.05);
  const free = (p: Point2D) => !!roomAt(layout, p) &&
    !furniture.some(f => Math.abs(p.x - f.x) < f.sizeX / 2 + ROBOT_CLEARANCE &&
      Math.abs(p.y - f.y) < f.sizeY / 2 + ROBOT_CLEARANCE) &&
    !layout.walls.some(w => {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - w.x1 - t * dx, p.y - w.y1 - t * dy) < ROBOT_CLEARANCE + 0.05;
    });
  const clear = (a: Point2D, b: Point2D) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.04));
    for (let i = 0; i <= n; i++) if (!free({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n })) return false;
    return true;
  };
  const minX = Math.min(...layout.rooms.map(r => r.minX));
  const minY = Math.min(...layout.rooms.map(r => r.minY));
  // Acrescenta o meio das passagens estreitas: a resolução da grade não pode fechar um vão livre.
  const axis = (min: number, max: number, edges: number[]) => {
    const values = Array.from({ length: Math.ceil((max - min) / STEP) + 1 }, (_, i) => min + i * STEP);
    const sorted = edges.sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]! - sorted[i - 1]!;
      if (gap > 0.001 && gap < STEP) values.push((sorted[i]! + sorted[i - 1]!) / 2);
    }
    return [...new Set(values)].sort((a, b) => a - b);
  };
  const xs = axis(minX, Math.max(...layout.rooms.map(r => r.maxX)), furniture.flatMap(f => [f.x - f.sizeX / 2 - ROBOT_CLEARANCE, f.x + f.sizeX / 2 + ROBOT_CLEARANCE]));
  const ys = axis(minY, Math.max(...layout.rooms.map(r => r.maxY)), furniture.flatMap(f => [f.y - f.sizeY / 2 - ROBOT_CLEARANCE, f.y + f.sizeY / 2 + ROBOT_CLEARANCE]));
  const nx = xs.length;
  const points = ys.flatMap(y => xs.map(x => ({ x, y })));
  const valid = points.map(free);
  const neighbors = points.map((p, i) => valid[i] ? [-nx, nx, -1, 1, -nx - 1, -nx + 1, nx - 1, nx + 1]
    .map(d => i + d).filter(j => j >= 0 && j < points.length && valid[j] &&
      Math.abs(j % nx - i % nx) <= 1 && clear(p, points[j]!)) : []);
  return { free, clear, points, valid, neighbors };
}
function mapFor(layout: HouseLayout) {
  let map = cache.get(layout);
  if (!map) { map = buildMap(layout); cache.set(layout, map); }
  return map;
}
export const robotSegmentClear = (layout: HouseLayout, a: Point2D, b: Point2D) => mapFor(layout).clear(a, b);

/** Navegação somente do simulador. O LiDAR e o Nav2 do equipamento real continuam independentes. */
export function planRobotPath(layout: HouseLayout, from: Point2D, to: Point2D): Point2D[] {
  const map = mapFor(layout);
  if (!map.free(from) || !roomAt(layout, to)) return [];
  if (map.clear(from, to)) return [from, to];
  const goalRoom = roomAt(layout, to)!.id;
  const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
  const starts = map.points.map((p, i) => ({ i, d: distance(p, from) }))
    .filter(({ i, d }) => map.valid[i] && d < STEP * 2 && map.clear(from, map.points[i]!));
  const previous = new Int32Array(map.points.length).fill(-2);
  const queue: number[] = [];
  for (const { i } of starts) { previous[i] = -1; queue.push(i); }
  // Explorar apenas posições alcançáveis permite parar ao lado de um destino ocupado.
  for (let head = 0; head < queue.length; head++) {
    for (const next of map.neighbors[queue[head]!]!) if (previous[next] === -2) {
      previous[next] = queue[head]!; queue.push(next);
    }
  }
  const goals = queue.filter(i => roomAt(layout, map.points[i]!)?.id === goalRoom)
    .sort((a, b) => distance(map.points[a]!, to) - distance(map.points[b]!, to));
  const goal = goals[0];
  if (goal === undefined) return [];
  const path: Point2D[] = [];
  for (let i = goal; i >= 0; i = previous[i]!) path.unshift(map.points[i]!);
  path.unshift(from);
  if (map.clear(path[path.length - 1]!, to)) path.push(to);
  const simplified = [from];
  for (let i = 0; i < path.length - 1;) {
    let next = path.length - 1;
    while (next > i + 1 && !map.clear(path[i]!, path[next]!)) next--;
    simplified.push(path[next]!); i = next;
  }
  return simplified;
}
