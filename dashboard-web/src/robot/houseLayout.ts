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

/** Velocidade de caminhada da pessoa (m/s): passo tranquilo de uma pessoa idosa. */
export const VELOCIDADE_PESSOA = 0.6;

/** Onde a pessoa fica num cômodo: ao lado do ponto do robô, sem encostar nas paredes. */
export const pontoDaPessoa = (room: Room): Point2D => ({
  x: Math.min(room.maxX - 0.4, room.targetX + 0.55),
  y: Math.min(room.maxY - 0.4, room.targetY + 0.35)
});

/** Identidade da planta: muda quando a família troca o modelo (para recriar cena e robô simulado). */
export const chavePlanta = (layout: HouseLayout): string =>
  `${layout.name}|${layout.rooms.map(r => r.id).join(',')}`;

/** Geometria da planta (cômodos, portas e móveis), para saber se uma planta salva ficou desatualizada. */
export const assinaturaPlanta = (l: HouseLayout): string => JSON.stringify([
  l.rooms.map(r => [r.id, r.name, r.minX, r.minY, r.maxX, r.maxY, r.targetX, r.targetY]),
  (l.doors ?? []).map(d => [d.a, d.b, d.x, d.y]),
  l.furniture.map(f => [f.name, f.roomId, f.x, f.y, f.sizeX, f.sizeY, f.height]),
]);

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
 * Variação de um cômodo repetido pelo número do id: "quarto" → 0, "quarto-2" → 1, "quarto-3" → 2…
 * Determinística: o mesmo cômodo tem sempre a mesma aparência ao recarregar.
 */
export const variante = (id: string): number => {
  const n = /-(\d+)$/.exec(id);
  return n ? Number(n[1]) - 1 : 0;
};

/** Tipo do cômodo sem o número ("quarto-2" → "quarto"). */
export const tipoComodo = (id: string): string => id.replace(/-\d+$/, '');

/** Casa com mais quartos ou banheiros que o padrão (ganha decoração extra na sala). */
export const casaMaior = (layout: HouseLayout): boolean =>
  layout.rooms.filter(r => tipoComodo(r.id) === 'quarto').length > 1 ||
  layout.rooms.filter(r => tipoComodo(r.id) === 'banheiro').length > 1;

/**
 * Gera a planta da família a partir do modelo (Casa térrea ou Apartamento, quartos, banheiros).
 *
 * Frente: sala e cozinha, ligadas por uma porta. Fundo: os quartos e depois os banheiros, cada um
 * com porta para o cômodo da frente que fica na direção dele. Mesmo formato da planta de exemplo
 * (metros, centro da casa perto de 0,0), para o painel 2D, a Casa 3D e o robô usarem igual.
 * Ids: "quarto", "quarto-2"…, "banheiro", "banheiro-2"… (o banheiro nunca é filmado).
 *
 * Em casas largas a sala não passa de ~2:1 (6,5 m na casa, 6 m no apartamento): a sobra da frente
 * vira "Sala de jantar" (entre a sala e a cozinha) e, se ainda sobrar, "Lavanderia" / "Área de serviço".
 */
export function layoutDoModelo(m: ModeloCasa): HouseLayout {
  const quartos = Math.min(4, Math.max(1, Math.round(m.bedrooms)));
  const banheiros = Math.min(3, Math.max(1, Math.round(m.bathrooms)));
  const casa = m.kind === 'HOUSE';
  const larguraQuarto = casa ? 3.6 : 3;
  const larguraBanheiro = casa ? 2.2 : 1.8;
  const fundoFrente = casa ? 4 : 3.6;
  const fundoTras = casa ? 4 : 3.4;
  const salaMaxima = casa ? 6.5 : 6;

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

  // Larguras da frente (da esquerda para a direita): sala | [jantar] | cozinha | [serviço]
  type Frente = { id: string; nome: string; largura: number };
  let frente: Frente[];
  const cozinhaPadrao = r1(Math.max(3, W * 0.38));
  if (W - cozinhaPadrao <= salaMaxima) {
    // Casa estreita: exatamente como antes (sala com a sobra)
    frente = [
      { id: 'sala', nome: 'Sala de estar', largura: r1(W - cozinhaPadrao) },
      { id: 'cozinha', nome: 'Cozinha', largura: cozinhaPadrao },
    ];
  } else {
    let cozinha = r1(Math.min(casa ? 4.5 : 4, Math.max(3, W * 0.3)));
    let sobra = r1(W - salaMaxima - cozinha);
    let jantar = 0;
    let servico = 0;
    if (sobra < 2.4) cozinha = r1(cozinha + sobra); // pouco espaço: a cozinha fica maior
    else if (sobra <= 4.8) jantar = sobra;
    else {
      servico = r1(Math.min(3, sobra - 3));
      jantar = r1(sobra - servico);
      if (jantar > 5) { cozinha = r1(cozinha + jantar - 5); jantar = 5; }
    }
    sobra = 0;
    frente = [
      { id: 'sala', nome: 'Sala de estar', largura: salaMaxima },
      ...(jantar ? [{ id: 'jantar', nome: 'Sala de jantar', largura: jantar }] : []),
      { id: 'cozinha', nome: 'Cozinha', largura: cozinha },
      ...(servico ? [{ id: 'servico', nome: casa ? 'Lavanderia' : 'Área de serviço', largura: servico }] : []),
    ];
  }

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

  const rooms: Room[] = [];
  let xf = x0;
  for (const c of frente) {
    rooms.push(comodo({ id: c.id, nome: c.nome, minX: r1(xf), maxX: r1(xf + c.largura), minY: yFrente, maxY: yMeio }));
    xf += c.largura;
  }
  rooms[rooms.length - 1]!.maxX = r1(x0 + W);
  const nFrente = rooms.length;
  // Ordem dos ids: sala, cozinha, quartos, banheiros e por fim jantar/serviço (quem já tinha a planta
  // antiga continua com os mesmos índices).
  const ordemFrente = rooms.slice();
  let x = x0;
  const fundo: Room[] = [];
  for (const c of tras) {
    fundo.push(comodo({ id: c.id, nome: c.nome, minX: r1(x), maxX: r1(x + c.largura), minY: yMeio, maxY: yFundo }));
    x += c.largura;
  }
  fundo[fundo.length - 1]!.maxX = r1(x0 + W);

  // Portas: entre os cômodos vizinhos da frente (no meio da divisa) e cada cômodo do fundo ↔ o da frente
  // abaixo dele, sempre com o vão inteiro dentro dos dois cômodos.
  const meiaPorta = casa ? 0.5 : 0.45;
  const yPortaFrente = r1((yFrente + yMeio) / 2);
  const doors: Door[] = [];
  // A porta da lavanderia fica perto do fundo: a parede da cozinha abaixo dela fica livre para a geladeira.
  const yPortaDivisa = (f: Room) => (f.id === 'servico' ? r1(yMeio - 0.8) : yPortaFrente);
  for (let i = 1; i < nFrente; i++) doors.push({ a: ordemFrente[i - 1]!.id, b: ordemFrente[i]!.id, x: ordemFrente[i]!.minX, y: yPortaDivisa(ordemFrente[i]!) });
  const vaos: [number, number][] = [];
  const folga = meiaPorta + 0.15;
  for (const r of fundo) {
    const cx = r1((r.minX + r.maxX) / 2);
    let alvo = ordemFrente.find(f => cx >= f.minX + folga && cx <= f.maxX - folga);
    let px = cx;
    if (!alvo) {
      // O meio do cômodo cai numa divisa da frente: porta no trecho em comum mais largo
      const comum = (f: Room) => Math.min(f.maxX, r.maxX) - Math.max(f.minX, r.minX);
      alvo = ordemFrente.slice().sort((a, b) => comum(b) - comum(a))[0]!;
      const a = Math.max(alvo.minX, r.minX) + folga, b = Math.min(alvo.maxX, r.maxX) - folga;
      px = r1(a <= b ? Math.min(b, Math.max(a, cx)) : (Math.max(alvo.minX, r.minX) + Math.min(alvo.maxX, r.maxX)) / 2);
    }
    doors.push({ a: alvo.id, b: r.id, x: px, y: yMeio });
    vaos.push([r1(px - meiaPorta), r1(px + meiaPorta)]);
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
  // Divisas da frente (sala | jantar | cozinha | serviço), com a porta no meio
  for (const f of ordemFrente.slice(1)) {
    const yp = yPortaDivisa(f);
    walls.push({ x1: f.minX, y1: yFrente, x2: f.minX, y2: r1(yp - 0.6) });
    if (yp + 0.6 < yMeio) walls.push({ x1: f.minX, y1: r1(yp + 0.6), x2: f.minX, y2: yMeio });
  }
  // Divisas entre os cômodos do fundo (fechadas)
  for (const r of fundo.slice(1)) walls.push({ x1: r.minX, y1: yMeio, x2: r.minX, y2: yFundo });

  const furniture: Furniture[] = [];
  const s = ordemFrente[0]!;
  furniture.push({ name: 'Sofá', roomId: 'sala', x: r1(s.minX + 0.6), y: r1((s.minY + s.maxY) / 2), sizeX: 0.8, sizeY: 1.8, height: 0.8 });
  furniture.push({ name: 'Rack da TV', roomId: 'sala', x: r1(s.minX + 2.4), y: r1((s.minY + s.maxY) / 2), sizeX: 0.4, sizeY: 1.4, height: 0.5 });
  const k = ordemFrente.find(r => r.id === 'cozinha')!;
  furniture.push({ name: 'Bancada', roomId: 'cozinha', x: r1((k.minX + k.maxX) / 2), y: r1(k.minY + 0.35), sizeX: r1(Math.min(2.6, k.maxX - k.minX - 0.6)), sizeY: 0.5, height: 0.9 });
  furniture.push({ name: 'Mesa', roomId: 'cozinha', x: r1((k.minX + k.maxX) / 2), y: r1((k.minY + k.maxY) / 2 + 0.3), sizeX: 1.2, sizeY: 0.8, height: 0.75 });
  const jantar = ordemFrente.find(r => r.id === 'jantar');
  if (jantar) {
    // Mesa para a frente da casa; o ponto do cômodo fica livre, entre a mesa e as portas do fundo
    const largura = r1(Math.min(1.6, jantar.maxX - jantar.minX - 1.4));
    furniture.push({ name: 'Mesa de jantar', roomId: 'jantar', x: r1((jantar.minX + jantar.maxX) / 2), y: r1(jantar.minY + 1.2), sizeX: largura, sizeY: 0.9, height: 0.75 });
    jantar.targetY = r1((jantar.minY + jantar.maxY) / 2 + 0.3);
  }
  const servico = ordemFrente.find(r => r.id === 'servico');
  if (servico) furniture.push({ name: 'Tanque', roomId: 'servico', x: r1(servico.maxX - 0.45), y: r1(servico.minY + 0.35), sizeX: 0.6, sizeY: 0.5, height: 0.85 });

  for (const r of fundo) {
    const v = variante(r.id);
    if (r.id.startsWith('quarto')) {
      // Casal no meio da parede do fundo, solteiro no canto esquerdo, hóspedes no canto direito,
      // casal encostado na parede direita (a cabeceira sempre na parede mais próxima).
      const camas: Furniture[] = [
        { name: 'Cama de casal', roomId: r.id, x: r1((r.minX + r.maxX) / 2), y: r1(r.maxY - 1.1), sizeX: 1.6, sizeY: 2, height: 0.5 },
        { name: 'Cama de solteiro', roomId: r.id, x: r1(r.minX + 1.1), y: r1(r.maxY - 0.55), sizeX: 2, sizeY: 0.9, height: 0.5 },
        { name: 'Cama de solteiro', roomId: r.id, x: r1(r.maxX - 1.1), y: r1(r.maxY - 0.55), sizeX: 2, sizeY: 0.9, height: 0.5 },
        { name: 'Cama de casal', roomId: r.id, x: r1(r.maxX - 1.1), y: r1(r.maxY - 0.9), sizeX: 2, sizeY: 1.6, height: 0.5 },
      ];
      furniture.push(camas[v % camas.length]!);
    } else {
      // Social (pia com gabinete), suíte (pia dupla) e lavabo (pia pequena)
      const pias: Furniture[] = [
        { name: 'Pia', roomId: r.id, x: r1(r.maxX - 0.5), y: r1(r.maxY - 0.35), sizeX: 0.8, sizeY: 0.5, height: 0.85 },
        { name: 'Pia dupla', roomId: r.id, x: r1(r.maxX - 0.75), y: r1(r.maxY - 0.35), sizeX: 1.3, sizeY: 0.5, height: 0.85 },
        { name: 'Pia', roomId: r.id, x: r1(r.maxX - 0.4), y: r1(r.maxY - 0.33), sizeX: 0.6, sizeY: 0.45, height: 0.85 },
      ];
      furniture.push(pias[v % pias.length]!);
    }
  }

  const ids = (tipo: string) => fundo.filter((r) => r.id.startsWith(tipo)).map((r) => r.id);
  const extras = ordemFrente.filter(r => r.id === 'jantar' || r.id === 'servico');
  return {
    name: `${casa ? 'Casa térrea' : 'Apartamento'} · ${quartos} ${quartos === 1 ? 'quarto' : 'quartos'} e ${banheiros} ${banheiros === 1 ? 'banheiro' : 'banheiros'}`,
    width: W,
    depth: r1(yFundo - yFrente),
    wallHeight: 1,
    // Base do robô na sala, longe das paredes e das portas
    dock: { x: r1(s.minX + 1.6), y: r1(s.minY + 1) },
    rooms: [s, k, ...fundo, ...extras],
    walls,
    furniture,
    patrolRoute: ['sala', ...ids('quarto'), 'sala', ...extras.map(r => r.id).filter(id => id === 'jantar'), 'cozinha',
      ...extras.map(r => r.id).filter(id => id === 'servico'), ...ids('banheiro'), 'sala'],
    doors,
  };
}
