// Planta da casa: cópia local usada quando o backend está offline (modo demonstração).
// Fonte oficial: GET /api/v1/house/layout (HouseLayoutService.java). Os números são os mesmos.
import type { Door, Furniture, HouseLayout, Point2D, Room, Wall } from '../types/robot';

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
export const DOORS: Door[] = [
  { a: 'sala', b: 'quarto', x: 0.6, y: 1 },
  { a: 'sala', b: 'cozinha', x: 3, y: -1 },
  { a: 'cozinha', b: 'banheiro', x: 4.2, y: 1 },
  { a: 'cozinha', b: 'escritorio', x: 7, y: 1 }
];

/** Cômodos por onde a pessoa simulada anda (banheiros ficam de fora: a câmera nunca os vê). */
export const comodosDaPessoa = (layout: HouseLayout): string[] => {
  const ids = layout.rooms.map(r => r.id).filter(id => !/^(banheiro|lavabo)(-\d+)?$/.test(id));
  return ids.length ? ids : layout.rooms.map(r => r.id);
};

/** Identidade da planta: muda quando a família troca o modelo (para recriar cena e robô simulado). */
export const chavePlanta = (layout: HouseLayout): string =>
  `${layout.name}|${layout.rooms.map(r => r.id).join(',')}`;

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
    for (const door of layout.doors ?? DOORS) {
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

// ------------------------------------------------------------------ planta a partir do modelo

/** Modelo escolhido no passo 5 do cadastro ("Montar por um modelo"). */
export interface ModeloCasa {
  kind: 'HOUSE' | 'APARTMENT';
  bedrooms: number;
  bathrooms: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Gera a planta da família a partir do modelo (Casa térrea ou Apartamento, quartos, banheiros).
 *
 * Frente: sala e cozinha, ligadas por uma porta. Fundo: os quartos e depois os banheiros, cada um
 * com porta para o cômodo da frente que fica na direção dele. Mesmo formato da planta de exemplo
 * (metros, centro da casa perto de 0,0), para o painel 2D, a Casa 3D e o robô usarem igual.
 * Ids: "quarto", "quarto-2"…, "banheiro", "banheiro-2"… (o banheiro nunca é filmado).
 */
export function layoutDoModelo(m: ModeloCasa): HouseLayout {
  const quartos = Math.min(4, Math.max(1, Math.round(m.bedrooms)));
  const banheiros = Math.min(3, Math.max(1, Math.round(m.bathrooms)));
  const casa = m.kind === 'HOUSE';
  const larguraQuarto = casa ? 3.6 : 3;
  const larguraBanheiro = casa ? 2.2 : 1.8;
  const fundoFrente = casa ? 4 : 3.6;
  const fundoTras = casa ? 4 : 3.4;

  const tras = [
    ...Array.from({ length: quartos }, (_, i) => ({
      id: i ? `quarto-${i + 1}` : 'quarto',
      nome: i ? `Quarto ${i + 1}` : 'Quarto',
      largura: larguraQuarto,
    })),
    ...Array.from({ length: banheiros }, (_, i) => ({
      id: i ? `banheiro-${i + 1}` : 'banheiro',
      nome: i ? `Banheiro ${i + 1}` : 'Banheiro',
      largura: larguraBanheiro,
    })),
  ];
  // A frente precisa de pelo menos 7 m (sala de 4 m e cozinha de 3 m): o primeiro quarto cresce.
  const somaTras = tras.reduce((s, c) => s + c.largura, 0);
  if (somaTras < 7) tras[0]!.largura += 7 - somaTras;
  const W = r1(tras.reduce((s, c) => s + c.largura, 0));
  const x0 = r1(-W / 2);
  // Casa centrada em y: frente de yFrente a yMeio, fundo de yMeio a yFundo
  const yFrente = r1(-(fundoFrente + fundoTras) / 2);
  const yMeio = r1(yFrente + fundoFrente);
  const yFundo = r1(yMeio + fundoTras);

  const larguraCozinha = r1(Math.max(3, W * 0.38));
  const xDivisa = r1(x0 + W - larguraCozinha);
  const sala = { id: 'sala', nome: 'Sala de estar', minX: x0, maxX: xDivisa, minY: yFrente, maxY: yMeio };
  const cozinha = { id: 'cozinha', nome: 'Cozinha', minX: xDivisa, maxX: r1(x0 + W), minY: yFrente, maxY: yMeio };

  const comodo = (c: { id: string; nome: string; minX: number; maxX: number; minY: number; maxY: number }): Room => ({
    id: c.id,
    name: c.nome,
    minX: c.minX,
    minY: c.minY,
    maxX: c.maxX,
    maxY: c.maxY,
    targetX: r1((c.minX + c.maxX) / 2),
    targetY: r1((c.minY + c.maxY) / 2),
  });

  const rooms: Room[] = [comodo(sala), comodo(cozinha)];
  let x = x0;
  for (const c of tras) {
    rooms.push(comodo({ id: c.id, nome: c.nome, minX: r1(x), maxX: r1(x + c.largura), minY: yMeio, maxY: yFundo }));
    x += c.largura;
  }
  rooms[rooms.length - 1]!.maxX = r1(x0 + W);

  // Portas: sala ↔ cozinha (na divisa da frente) e cada cômodo do fundo ↔ o da frente abaixo dele.
  const meiaPorta = casa ? 0.5 : 0.45;
  const yPortaFrente = r1((yFrente + yMeio) / 2);
  const doors: Door[] = [{ a: 'sala', b: 'cozinha', x: xDivisa, y: yPortaFrente }];
  const vaos: [number, number][] = [];
  for (const r of rooms.slice(2)) {
    const cx = r1((r.minX + r.maxX) / 2);
    const frente = cx < xDivisa ? 'sala' : 'cozinha';
    doors.push({ a: frente, b: r.id, x: cx, y: yMeio });
    vaos.push([r1(cx - meiaPorta), r1(cx + meiaPorta)]);
  }

  const walls: Wall[] = [
    { x1: x0, y1: yFrente, x2: r1(x0 + W), y2: yFrente },
    { x1: r1(x0 + W), y1: yFrente, x2: r1(x0 + W), y2: yFundo },
    { x1: r1(x0 + W), y1: yFundo, x2: x0, y2: yFundo },
    { x1: x0, y1: yFundo, x2: x0, y2: yFrente },
  ];
  // Parede do meio (frente | fundo) com um vão por porta
  let inicio = x0;
  for (const [a, b] of vaos.sort((p, q) => p[0] - q[0])) {
    if (a > inicio) walls.push({ x1: r1(inicio), y1: yMeio, x2: a, y2: yMeio });
    inicio = b;
  }
  if (inicio < x0 + W) walls.push({ x1: r1(inicio), y1: yMeio, x2: r1(x0 + W), y2: yMeio });
  // Sala | cozinha, com a porta no meio
  walls.push({ x1: xDivisa, y1: yFrente, x2: xDivisa, y2: r1(yPortaFrente - 0.6) });
  walls.push({ x1: xDivisa, y1: r1(yPortaFrente + 0.6), x2: xDivisa, y2: yMeio });
  // Divisas entre os cômodos do fundo (fechadas)
  for (const r of rooms.slice(3)) walls.push({ x1: r.minX, y1: yMeio, x2: r.minX, y2: yFundo });

  const furniture: Furniture[] = [];
  const s = rooms[0]!;
  furniture.push({ name: 'Sofá', roomId: 'sala', x: r1(s.minX + 0.6), y: r1((s.minY + s.maxY) / 2), sizeX: 0.8, sizeY: 1.8, height: 0.8 });
  furniture.push({ name: 'Rack da TV', roomId: 'sala', x: r1(s.minX + 2.4), y: r1((s.minY + s.maxY) / 2), sizeX: 0.4, sizeY: 1.4, height: 0.5 });
  const k = rooms[1]!;
  furniture.push({ name: 'Bancada', roomId: 'cozinha', x: r1((k.minX + k.maxX) / 2), y: r1(k.minY + 0.35), sizeX: r1(Math.min(2.6, k.maxX - k.minX - 0.6)), sizeY: 0.5, height: 0.9 });
  furniture.push({ name: 'Mesa', roomId: 'cozinha', x: r1((k.minX + k.maxX) / 2), y: r1((k.minY + k.maxY) / 2 + 0.3), sizeX: 1.2, sizeY: 0.8, height: 0.75 });
  for (const r of rooms.slice(2)) {
    if (r.id.startsWith('quarto'))
      furniture.push({ name: 'Cama', roomId: r.id, x: r1((r.minX + r.maxX) / 2), y: r1(r.maxY - 1.1), sizeX: 1.6, sizeY: 2, height: 0.5 });
    else
      furniture.push({ name: 'Pia', roomId: r.id, x: r1(r.maxX - 0.5), y: r1(r.maxY - 0.35), sizeX: 0.8, sizeY: 0.5, height: 0.85 });
  }

  const idsQuartos = rooms.filter((r) => r.id.startsWith('quarto')).map((r) => r.id);
  const idsBanheiros = rooms.filter((r) => r.id.startsWith('banheiro')).map((r) => r.id);
  return {
    name: `${casa ? 'Casa térrea' : 'Apartamento'} · ${quartos} ${quartos === 1 ? 'quarto' : 'quartos'} e ${banheiros} ${banheiros === 1 ? 'banheiro' : 'banheiros'}`,
    width: W,
    depth: r1(yFundo - yFrente),
    wallHeight: 1,
    // Base do robô na sala, longe das paredes e das portas
    dock: { x: r1(s.minX + 1.6), y: r1(s.minY + 1) },
    rooms,
    walls,
    furniture,
    patrolRoute: ['sala', ...idsQuartos, 'sala', 'cozinha', ...idsBanheiros, 'sala'],
    doors,
  };
}
