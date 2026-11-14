import type { HouseLayout, Point2D, Room } from '../types/robot';
import { DOORS, findRoom, pontoDaPessoa, roomAt } from './houseLayout';
import { roomDecorations } from '../components/house3d/decorations';

// Inclui rodas e uma margem de segurança. Tapetes não bloqueiam a circulação.
export const ROBOT_CLEARANCE = 0.21;
/** Pessoa: ~0,3 m de margem dos móveis e das paredes (corpo + espaço para a bengala). */
export const PERSON_CLEARANCE = 0.3;
const STEP = 0.08;
const cache = new WeakMap<HouseLayout, Map<string, ReturnType<typeof buildMap>>>();
/** Menor distância entre os segmentos AB e CD. */
function distanciaSegmentos(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const ponto = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const ux = x2 - x1, uy = y2 - y1, l = ux * ux + uy * uy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * ux + (py - y1) * uy) / l));
    return Math.hypot(px - x1 - t * ux, py - y1 - t * uy);
  };
  const cruz = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d1 = cruz(ax, ay, bx, by, cx, cy), d2 = cruz(ax, ay, bx, by, dx, dy);
  const d3 = cruz(cx, cy, dx, dy, ax, ay), d4 = cruz(cx, cy, dx, dy, bx, by);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(ponto(ax, ay, cx, cy, dx, dy), ponto(bx, by, cx, cy, dx, dy), ponto(cx, cy, ax, ay, bx, by), ponto(dx, dy, ax, ay, bx, by));
}

function buildMap(layout: HouseLayout, clearance: number, wallClearance: number) {
  const furniture = [...layout.furniture, ...roomDecorations(layout)].filter(f => f.height > 0.05);
  // Tudo em vetores simples: esta função roda centenas de milhares de vezes ao montar a grade.
  const box = new Float64Array(furniture.length * 4);
  furniture.forEach((f, i) => box.set([f.x - f.sizeX / 2 - clearance, f.x + f.sizeX / 2 + clearance,
    f.y - f.sizeY / 2 - clearance, f.y + f.sizeY / 2 + clearance], i * 4));
  const walls = new Float64Array(layout.walls.length * 5);
  layout.walls.forEach((w, i) => {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    walls.set([w.x1, w.y1, dx, dy, dx * dx + dy * dy || 1], i * 5);
  });
  const rooms = new Float64Array(layout.rooms.length * 4);
  layout.rooms.forEach((r, i) => rooms.set([r.minX, r.maxX, r.minY, r.maxY], i * 4));
  const wall2 = wallClearance * wallClearance;
  const livre = (x: number, y: number) => {
    let inside = false;
    for (let i = 0; i < rooms.length; i += 4) {
      if (x >= rooms[i]! && x <= rooms[i + 1]! && y >= rooms[i + 2]! && y <= rooms[i + 3]!) { inside = true; break; }
    }
    if (!inside) return false;
    for (let i = 0; i < box.length; i += 4) {
      if (x > box[i]! && x < box[i + 1]! && y > box[i + 2]! && y < box[i + 3]!) return false;
    }
    for (let i = 0; i < walls.length; i += 5) {
      const x1 = walls[i]!, y1 = walls[i + 1]!, dx = walls[i + 2]!, dy = walls[i + 3]!;
      let t = ((x - x1) * dx + (y - y1) * dy) / walls[i + 4]!;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - x1 - t * dx, ey = y - y1 - t * dy;
      if (ex * ex + ey * ey < wall2) return false;
    }
    return true;
  };
  const free = (p: Point2D) => livre(p.x, p.y);
  /** Teste exato do segmento: atravessa a folga de algum móvel (retângulo) ou chega perto de uma parede? */
  // Baldes de 1 m com os obstáculos de cada pedaço da casa: o teste de um trecho curto só olha o que está perto.
  const bx0 = Math.min(...layout.rooms.map(r => r.minX)) - 1, by0 = Math.min(...layout.rooms.map(r => r.minY)) - 1;
  const bnx = Math.ceil(Math.max(...layout.rooms.map(r => r.maxX)) - bx0) + 2;
  const bny = Math.ceil(Math.max(...layout.rooms.map(r => r.maxY)) - by0) + 2;
  const baldes: { moveis: number[]; paredes: number[] }[] = Array.from({ length: bnx * bny }, () => ({ moveis: [], paredes: [] }));
  const faixa = (x0: number, x1: number, y0: number, y1: number, cada: (b: { moveis: number[]; paredes: number[] }) => void) => {
    const i0 = Math.max(0, Math.floor(x0 - bx0)), i1 = Math.min(bnx - 1, Math.floor(x1 - bx0));
    const j0 = Math.max(0, Math.floor(y0 - by0)), j1 = Math.min(bny - 1, Math.floor(y1 - by0));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cada(baldes[j * bnx + i]!);
  };
  for (let i = 0; i < box.length; i += 4) faixa(box[i]!, box[i + 1]!, box[i + 2]!, box[i + 3]!, b => b.moveis.push(i));
  for (let i = 0; i < walls.length; i += 5) {
    const x1 = walls[i]!, y1 = walls[i + 1]!, x2 = x1 + walls[i + 2]!, y2 = y1 + walls[i + 3]!;
    faixa(Math.min(x1, x2) - wallClearance, Math.max(x1, x2) + wallClearance, Math.min(y1, y2) - wallClearance, Math.max(y1, y2) + wallClearance, b => b.paredes.push(i));
  }
  const vistos = new Int32Array(box.length + walls.length);
  let rodada = 0;
  const exato = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax, dy = by - ay;
    const sx0 = Math.min(ax, bx), sx1 = Math.max(ax, bx), sy0 = Math.min(ay, by), sy1 = Math.max(ay, by);
    rodada++;
    let livreTrecho = true;
    faixa(sx0, sx1, sy0, sy1, balde => {
      if (!livreTrecho) return;
      for (const i of balde.moveis) {
        if (vistos[i] === rodada) continue;
        vistos[i] = rodada;
        const x0 = box[i]!, x1 = box[i + 1]!, y0 = box[i + 2]!, y1 = box[i + 3]!;
        if (sx1 <= x0 || sx0 >= x1 || sy1 <= y0 || sy0 >= y1) continue; // longe do móvel
        // Slab: intervalo de t em que o segmento está dentro do retângulo aberto
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-12) { if (ax <= x0 || ax >= x1) continue; }
        else {
          const u = (x0 - ax) / dx, v = (x1 - ax) / dx;
          t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
          if (t0 >= t1) continue;
        }
        if (Math.abs(dy) < 1e-12) { if (ay <= y0 || ay >= y1) continue; }
        else {
          const u = (y0 - ay) / dy, v = (y1 - ay) / dy;
          t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
          if (t0 >= t1) continue;
        }
        livreTrecho = false;
        return;
      }
      for (const i of balde.paredes) {
        const k = box.length + i;
        if (vistos[k] === rodada) continue;
        vistos[k] = rodada;
        const wx = walls[i]!, wy = walls[i + 1]!, wx2 = wx + walls[i + 2]!, wy2 = wy + walls[i + 3]!;
        if (Math.min(wx, wx2) - wallClearance >= sx1 || Math.max(wx, wx2) + wallClearance <= sx0 ||
            Math.min(wy, wy2) - wallClearance >= sy1 || Math.max(wy, wy2) + wallClearance <= sy0) continue;
        if (distanciaSegmentos(ax, ay, bx, by, wx, wy, wx2, wy2) < wallClearance) { livreTrecho = false; return; }
      }
    });
    return livreTrecho;
  };
  const clear = (a: Point2D, b: Point2D) => {
    // Dentro da casa: amostras bastam (os cômodos encostam uns nos outros, sem frestas)
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.04));
    for (let i = 0; i <= n; i++) if (!livre(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    return exato(a.x, a.y, b.x, b.y);
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
  const xs = axis(minX, Math.max(...layout.rooms.map(r => r.maxX)), furniture.flatMap(f => [f.x - f.sizeX / 2 - clearance, f.x + f.sizeX / 2 + clearance]));
  const ys = axis(minY, Math.max(...layout.rooms.map(r => r.maxY)), furniture.flatMap(f => [f.y - f.sizeY / 2 - clearance, f.y + f.sizeY / 2 + clearance]));
  const nx = xs.length;
  const points = ys.flatMap(y => xs.map(x => ({ x, y })));
  const valid = points.map(free);
  // Vizinhos calculados só quando a busca chega no ponto (a maior parte da grade nunca é visitada)
  const cacheVizinhos: (number[] | undefined)[] = new Array(points.length);
  const neighbors = (i: number): number[] => {
    let lista = cacheVizinhos[i];
    if (lista) return lista;
    lista = [];
    if (valid[i]) {
      const p = points[i]!;
      for (const d of [-nx, nx, -1, 1, -nx - 1, -nx + 1, nx - 1, nx + 1]) {
        const j = i + d;
        if (j < 0 || j >= points.length || !valid[j] || Math.abs(j % nx - i % nx) > 1) continue;
        // As pontas já são livres e dentro da casa: falta o teste exato do trecho
        const q = points[j]!;
        if (exato(p.x, p.y, q.x, q.y)) lista.push(j);
      }
    }
    cacheVizinhos[i] = lista;
    return lista;
  };
  /** Índices da grade a menos de `raio` de `p` (busca direta nos eixos, sem varrer a grade toda). */
  const near = (p: Point2D, raio: number): number[] => {
    const result: number[] = [];
    const lo = (arr: number[], v: number) => { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m]! < v) a = m + 1; else b = m; } return a; };
    for (let yi = lo(ys, p.y - raio); yi < ys.length && ys[yi]! <= p.y + raio; yi++) {
      for (let xi = lo(xs, p.x - raio); xi < nx && xs[xi]! <= p.x + raio; xi++) {
        const i = yi * nx + xi;
        if (Math.hypot(xs[xi]! - p.x, ys[yi]! - p.y) < raio) result.push(i);
      }
    }
    return result;
  };
  return { free, clear, points, valid, neighbors, near };
}
function mapFor(layout: HouseLayout, clearance = ROBOT_CLEARANCE, wall = ROBOT_CLEARANCE + 0.05) {
  let maps = cache.get(layout);
  if (!maps) { maps = new Map(); cache.set(layout, maps); }
  const key = `${clearance}/${wall}`;
  let map = maps.get(key);
  if (!map) { map = buildMap(layout, clearance, wall); maps.set(key, map); }
  return map;
}
const personMap = (layout: HouseLayout) => mapFor(layout, PERSON_CLEARANCE, PERSON_CLEARANCE);
export const robotSegmentClear = (layout: HouseLayout, a: Point2D, b: Point2D) => mapFor(layout).clear(a, b);

/** Navegação somente do simulador. O LiDAR e o Nav2 do equipamento real continuam independentes. */
export function planRobotPath(layout: HouseLayout, from: Point2D, to: Point2D): Point2D[] {
  const map = mapFor(layout);
  if (!map.free(from) || !roomAt(layout, to)) return [];
  if (map.clear(from, to)) return [from, to];
  const goalRoom = roomAt(layout, to)!.id;
  const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
  const starts = map.near(from, STEP * 2).map(i => ({ i }))
    .filter(({ i }) => map.valid[i] && map.clear(from, map.points[i]!));
  const previous = new Int32Array(map.points.length).fill(-2);
  const queue: number[] = [];
  for (const { i } of starts) { previous[i] = -1; queue.push(i); }
  // Explorar apenas posições alcançáveis permite parar ao lado de um destino ocupado.
  for (let head = 0; head < queue.length; head++) {
    for (const next of map.neighbors(queue[head]!)) if (previous[next] === -2) {
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

// ------------------------------------------------------------------ pessoa

const dentro = (r: Room, p: Point2D, folga = 0.01) =>
  p.x >= r.minX - folga && p.x <= r.maxX + folga && p.y >= r.minY - folga && p.y <= r.maxY + folga;
const distancia = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Caminho na grade de `a` até `b` usando só pontos dentro do cômodo `room` (busca em largura e depois
 * corta os cantos com linhas livres). Vazio se não houver passagem.
 */
function trecho(layout: HouseLayout, room: Room, a: Point2D, b: Point2D): Point2D[] {
  const map = personMap(layout);
  if (map.clear(a, b)) return [a, b];
  const perto = (p: Point2D) => map.near(p, STEP * 2.5)
    .filter(i => map.valid[i] && dentro(room, map.points[i]!) && map.clear(p, map.points[i]!));
  const inicio = perto(a);
  const fim = new Set(perto(b));
  if (!inicio.length || !fim.size) return [];
  const previous = new Int32Array(map.points.length).fill(-2);
  const queue: number[] = [];
  for (const i of inicio) { previous[i] = -1; queue.push(i); }
  let achou = -1;
  for (let head = 0; head < queue.length && achou < 0; head++) {
    const atual = queue[head]!;
    if (fim.has(atual)) { achou = atual; break; }
    for (const next of map.neighbors(atual)) if (previous[next] === -2 && dentro(room, map.points[next]!)) {
      previous[next] = atual; queue.push(next);
    }
  }
  if (achou < 0) return [];
  const path: Point2D[] = [];
  for (let i = achou; i >= 0; i = previous[i]!) path.unshift(map.points[i]!);
  path.unshift(a);
  path.push(b);
  const simplificado = [a];
  for (let i = 0; i < path.length - 1;) {
    let next = path.length - 1;
    while (next > i + 1 && !map.clear(path[i]!, path[next]!)) next--;
    simplificado.push(path[next]!); i = next;
  }
  return simplificado;
}

/** O ponto livre (para a pessoa) mais próximo de `p`, de preferência no mesmo cômodo. */
export function pontoLivre(layout: HouseLayout, p: Point2D, room = roomAt(layout, p)): Point2D {
  const map = personMap(layout);
  if (map.free(p) && (!room || dentro(room, p, 0))) return p;
  let melhor: Point2D | null = null;
  for (let i = 0; i < map.points.length; i++) {
    const q = map.points[i]!;
    if (!map.valid[i] || (room && !dentro(room, q, 0))) continue;
    if (!melhor || distancia(q, p) < distancia(melhor, p)) melhor = q;
  }
  return melhor ?? p;
}

const destinos = new WeakMap<HouseLayout, Map<string, Point2D>>();
/**
 * Onde a pessoa fica no cômodo: o ponto de sempre (ao lado do ponto do robô) ou, se ele cair dentro
 * de um móvel ou perto demais de uma parede, o ponto livre mais próximo que se alcança pela porta.
 */
export function pontoLivreDaPessoa(layout: HouseLayout, room: Room): Point2D {
  let cache = destinos.get(layout);
  if (!cache) { cache = new Map(); destinos.set(layout, cache); }
  const salvo = cache.get(room.id);
  if (salvo) return salvo;
  const map = personMap(layout);
  const desejado = pontoDaPessoa(room);
  // Pontos do cômodo alcançáveis a partir das portas dele
  const portas = (layout.doors ?? DOORS).filter(d => d.a === room.id || d.b === room.id);
  const alcancavel = new Set<number>();
  const queue: number[] = [];
  for (const d of portas) for (const i of map.near(d, STEP * 2.5)) {
    if (map.valid[i] && dentro(room, map.points[i]!) && map.clear(d, map.points[i]!) && !alcancavel.has(i)) {
      alcancavel.add(i); queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) for (const next of map.neighbors(queue[head]!)) {
    if (!alcancavel.has(next) && dentro(room, map.points[next]!)) { alcancavel.add(next); queue.push(next); }
  }
  let ponto: Point2D;
  if (!alcancavel.size) ponto = pontoLivre(layout, desejado, room);
  else {
    const perto = [...alcancavel].map(i => map.points[i]!).filter(q => dentro(room, q, 0))
      .sort((a, b) => distancia(a, desejado) - distancia(b, desejado));
    ponto = map.free(desejado) && perto[0] && map.clear(perto[0], desejado) ? desejado : perto[0] ?? desejado;
  }
  cache.set(room.id, ponto);
  return ponto;
}

/** O ponto está livre para a pessoa (fora de móveis e longe das paredes)? */
export const pessoaLivre = (layout: HouseLayout, p: Point2D) => personMap(layout).free(p);
/** O trecho reto entre dois pontos está livre para a pessoa? */
export const pessoaTrechoLivre = (layout: HouseLayout, a: Point2D, b: Point2D) => personMap(layout).clear(a, b);

/**
 * Caminho da pessoa: cômodo a cômodo pelas portas (sempre pelo meio do vão) e, dentro de cada
 * cômodo, desviando dos móveis com 0,3 m de folga. Se ela estiver dentro de um móvel, o caminho
 * começa no ponto livre mais próximo. Vazio se não houver passagem.
 */
export function planPersonPath(layout: HouseLayout, from: Point2D, to: Point2D): Point2D[] {
  const inicio = pontoLivre(layout, from);
  const fim = pontoLivre(layout, to);
  const a = roomAt(layout, inicio), b = roomAt(layout, fim);
  if (!a || !b) return [];
  // Sequência de cômodos e portas (busca em largura no grafo de portas)
  const previous = new Map<string, { room: string; door: Point2D }>();
  const queue = [a.id];
  const visitados = new Set([a.id]);
  for (let head = 0; head < queue.length && !previous.has(b.id); head++) {
    for (const door of layout.doors ?? DOORS) {
      const atual = queue[head]!;
      const next = door.a === atual ? door.b : door.b === atual ? door.a : null;
      if (next && !visitados.has(next)) { visitados.add(next); previous.set(next, { room: atual, door }); queue.push(next); }
    }
  }
  if (a.id !== b.id && !previous.has(b.id)) return [];
  const etapas: { room: Room; ate: Point2D }[] = [];
  let ate = fim;
  for (let id = b.id; id !== a.id;) {
    const passo = previous.get(id)!;
    etapas.unshift({ room: findRoom(layout, id)!, ate });
    ate = { x: passo.door.x, y: passo.door.y };
    id = passo.room;
  }
  etapas.unshift({ room: a, ate });
  const caminho: Point2D[] = [from];
  if (distancia(from, inicio) > 1e-6) caminho.push(inicio);
  let de = inicio;
  for (const etapa of etapas) {
    const parte = trecho(layout, etapa.room, de, etapa.ate);
    if (!parte.length) return [];
    caminho.push(...parte.slice(1));
    de = etapa.ate;
  }
  return caminho.filter((p, i) => i === 0 || distancia(p, caminho[i - 1]!) > 1e-6);
}
