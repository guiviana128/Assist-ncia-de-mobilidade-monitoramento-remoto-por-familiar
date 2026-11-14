import type { Furniture, HouseLayout, Point2D, Room } from '../../types/robot';
import { DOORS, casaMaior, planPath, pontoDaPessoa, tipoComodo, variante } from '../../robot/houseLayout';

export interface VisualFurniture extends Furniture { yaw?: number }

type Decoration = Pick<Furniture, 'name' | 'sizeX' | 'sizeY' | 'height'>;
const d = (name: string, sizeX: number, sizeY: number, height: number): Decoration => ({ name, sizeX, sizeY, height });
const planta = d('Planta', 0.28, 0.28, 0.45);

/**
 * Variações de quartos e banheiros, escolhidas pelo número do cômodo (quarto, quarto-2…).
 * A cama e a pia vêm da planta (layoutDoModelo); aqui ficam os demais móveis de cada estilo.
 */
const variacoes: Record<string, Decoration[][]> = {
  quarto: [
    // casal: guarda-roupa e um criado-mudo de cada lado da cama
    [d('Guarda-roupa', 1.1, 0.45, 1.65), d('Criado-mudo', 0.35, 0.35, 0.48), d('Criado-mudo', 0.35, 0.35, 0.48), d('Cômoda', 0.72, 0.38, 0.82), planta],
    // solteiro: escrivaninha com cadeira
    [d('Escrivaninha', 1, 0.5, 0.75), d('Criado-mudo', 0.35, 0.35, 0.48), d('Estante', 0.68, 0.28, 1.3), planta],
    // hóspedes: poltrona e cômoda
    [d('Poltrona', 0.65, 0.65, 0.8), d('Cômoda', 0.72, 0.38, 0.82), d('Criado-mudo', 0.35, 0.35, 0.48)],
    // casal com a cama na parede lateral
    [d('Guarda-roupa', 1.1, 0.45, 1.65), d('Criado-mudo', 0.35, 0.35, 0.48), d('Criado-mudo', 0.35, 0.35, 0.48), d('Poltrona', 0.65, 0.65, 0.8), planta]
  ],
  banheiro: [
    // social: pia com gabinete, vaso e box
    [d('Chuveiro', 0.7, 0.7, 1.8), d('Vaso sanitário', 0.42, 0.64, 0.65)],
    // suíte: pia dupla, box maior e armário
    [d('Chuveiro', 0.9, 0.9, 1.8), d('Vaso sanitário', 0.42, 0.64, 0.65), d('Armário', 0.6, 0.35, 1.5)],
    // lavabo: pia e vaso, sem box
    [d('Vaso sanitário', 0.42, 0.64, 0.65)]
  ]
};

const extras: Record<string, Decoration[]> = {
  cozinha: [d('Geladeira', 0.62, 0.6, 1.65), d('Fogão', 0.55, 0.55, 0.85), d('Armário', 0.8, 0.4, 1.25)],
  sala: [d('Mesa lateral', 0.45, 0.45, 0.52), d('Estante', 0.68, 0.28, 1.3), d('Poltrona', 0.65, 0.65, 0.8), d('Planta', 0.3, 0.3, 0.5)],
  jantar: [d('Aparador', 1.2, 0.4, 0.8), planta],
  escritorio: [d('Armário', 0.7, 0.35, 1.35)],
  servico: [d('Máquina de lavar', 0.6, 0.6, 0.85), d('Armário', 0.65, 0.4, 1.1)]
};

/** Só em casas maiores (mais de 1 quarto ou de 1 banheiro): sala mais completa. */
const salaMaior: Decoration[] = [
  d('Estante de livros', 1, 0.32, 1.8), d('Poltrona', 0.65, 0.65, 0.8), d('Luminária de chão', 0.35, 0.35, 1.55), d('Planta', 0.3, 0.3, 0.5)
];

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Móveis decorativos de um cômodo, conforme o tipo e a variação dele. */
export function itensDoComodo(layout: HouseLayout, room: Room): Decoration[] {
  const tipo = semAcento(tipoComodo(room.id));
  const lista = variacoes[tipo];
  const itens = lista ? lista[variante(room.id) % lista.length]! : extras[tipo] ?? [planta];
  return tipo === 'sala' && casaMaior(layout) ? [...itens, ...salaMaior] : itens;
}

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

function candidates(room: Room, item: Decoration): VisualFurniture[] {
  const points: VisualFurniture[] = [];
  const add = (x: number, y: number, sideways: boolean, yaw: number) => points.push({
    ...item, roomId: room.id, x, y, yaw,
    sizeX: sideways ? item.sizeY : item.sizeX,
    sizeY: sideways ? item.sizeX : item.sizeY
  });
  // A profundidade sempre aponta para o interior, com as costas junto à parede.
  const inset = item.sizeY / 2 + 0.12;
  if (room.maxY - room.minY > item.sizeY + 0.24) {
    for (let x = room.minX + item.sizeX / 2 + 0.12; x <= room.maxX - item.sizeX / 2 - 0.12; x += 0.15) {
      add(x, room.maxY - inset, false, 0);
      add(x, room.minY + inset, false, Math.PI);
    }
  }
  if (room.maxX - room.minX > item.sizeY + 0.24) {
    for (let y = room.minY + item.sizeX / 2 + 0.12; y <= room.maxY - item.sizeX / 2 - 0.12; y += 0.15) {
      add(room.minX + inset, y, true, Math.PI / 2);
      add(room.maxX - inset, y, true, -Math.PI / 2);
    }
  }
  return points;
}

/** Faixa de 80 cm reservada para alcançar e abrir a geladeira. */
export function fridgeAccess(f: VisualFurniture): Furniture {
  const yaw = f.yaw ?? 0;
  const sideways = Math.abs(Math.sin(yaw)) > 0.5;
  const depth = sideways ? f.sizeX : f.sizeY;
  return { ...f, name: 'Acesso da geladeira',
    x: f.x + Math.sin(yaw) * (depth / 2 + 0.4),
    y: f.y - Math.cos(yaw) * (depth / 2 + 0.4),
    sizeX: sideways ? 0.8 : f.sizeX + 0.1,
    sizeY: sideways ? f.sizeY + 0.1 : 0.8
  };
}

function insideRoom(f: Furniture, r: Room) {
  return f.x - f.sizeX / 2 >= r.minX + 0.08 && f.x + f.sizeX / 2 <= r.maxX - 0.08 &&
    f.y - f.sizeY / 2 >= r.minY + 0.08 && f.y + f.sizeY / 2 <= r.maxY - 0.08;
}

/**
 * Circulação do cômodo com estes móveis: com 0,3 m de folga (a mesma da pessoa), todas as portas
 * continuam ligadas entre si e ao ponto livre mais próximo de onde a pessoa fica. Grade de 10 cm.
 */
const longeDasParedes = new WeakMap<HouseLayout, Map<string, Uint8Array>>();
function circulacaoLivre(layout: HouseLayout, room: Room, solidos: Furniture[]): boolean {
  const passo = 0.1, folga = 0.3;
  const nx = Math.round((room.maxX - room.minX) / passo), ny = Math.round((room.maxY - room.minY) / passo);
  const moveis = solidos.filter(f => f.height > 0.05 &&
    f.x + f.sizeX / 2 + folga > room.minX && f.x - f.sizeX / 2 - folga < room.maxX &&
    f.y + f.sizeY / 2 + folga > room.minY && f.y - f.sizeY / 2 - folga < room.maxY);
  const centro = (i: number) => ({ x: room.minX + (i % nx + 0.5) * passo, y: room.minY + (Math.floor(i / nx) + 0.5) * passo });
  // Longe das paredes: não muda entre uma tentativa e outra, então fica guardado por cômodo
  let porLayout = longeDasParedes.get(layout);
  if (!porLayout) { porLayout = new Map(); longeDasParedes.set(layout, porLayout); }
  let base = porLayout.get(room.id);
  if (!base) {
    base = new Uint8Array(nx * ny);
    for (let i = 0; i < base.length; i++) {
      const { x, y } = centro(i);
      base[i] = layout.walls.some(w => {
        const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
        const t = Math.max(0, Math.min(1, ((x - w.x1) * dx + (y - w.y1) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(x - w.x1 - t * dx, y - w.y1 - t * dy) < folga;
      }) ? 0 : 1;
    }
    porLayout.set(room.id, base);
  }
  const livre = base.slice();
  for (const f of moveis) {
    // Marca as células cobertas pelo móvel com a folga
    const x0 = Math.max(0, Math.floor((f.x - f.sizeX / 2 - folga - room.minX) / passo - 0.5));
    const x1 = Math.min(nx - 1, Math.ceil((f.x + f.sizeX / 2 + folga - room.minX) / passo - 0.5));
    const y0 = Math.max(0, Math.floor((f.y - f.sizeY / 2 - folga - room.minY) / passo - 0.5));
    const y1 = Math.min(ny - 1, Math.ceil((f.y + f.sizeY / 2 + folga - room.minY) / passo - 0.5));
    for (let yi = y0; yi <= y1; yi++) for (let xi = x0; xi <= x1; xi++) {
      const i = yi * nx + xi, { x, y } = centro(i);
      if (Math.abs(x - f.x) < f.sizeX / 2 + folga && Math.abs(y - f.y) < f.sizeY / 2 + folga) livre[i] = 0;
    }
  }
  const maisPerto = (p: Point2D, raio = Infinity) => {
    let melhor = -1, dist = raio;
    for (let i = 0; i < livre.length; i++) if (livre[i]) {
      const c = centro(i), d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < dist) { dist = d; melhor = i; }
    }
    return melhor;
  };
  const portas = (layout.doors ?? DOORS).filter(d => d.a === room.id || d.b === room.id).map(d => maisPerto(d, 0.45));
  if (portas.some(i => i < 0)) return false;
  const alvo = maisPerto(pontoDaPessoa(room));
  if (alvo < 0) return false;
  const visto = new Uint8Array(livre.length);
  const fila = [portas[0] ?? alvo];
  visto[fila[0]!] = 1;
  for (let h = 0; h < fila.length; h++) {
    const i = fila[h]!, cx = i % nx;
    for (const j of [i - nx, i + nx, cx > 0 ? i - 1 : -1, cx < nx - 1 ? i + 1 : -1]) {
      if (j >= 0 && j < livre.length && livre[j] && !visto[j]) { visto[j] = 1; fila.push(j); }
    }
  }
  return portas.every(i => visto[i]) && !!visto[alvo];
}

/** Cabeceira da cama: encostada na parede mais próxima no sentido do comprimento (igual ao modelo 3D). */
export function cabeceira(cama: Furniture, room: Room): 'norte' | 'sul' | 'oeste' | 'leste' {
  if (cama.sizeX > cama.sizeY) return cama.x - room.minX < room.maxX - cama.x ? 'oeste' : 'leste';
  return room.maxY - cama.y < cama.y - room.minY ? 'norte' : 'sul';
}

/** Posições de um criado-mudo dos dois lados da cabeceira. */
function aoLadoDaCama(cama: Furniture, room: Room, item: Decoration): VisualFurniture[] {
  const lado = cabeceira(cama, room);
  const meio = item.sizeX / 2 + 0.12;
  const at = (x: number, y: number, yaw: number): VisualFurniture => ({ ...item, roomId: room.id, x, y, yaw });
  if (lado === 'norte' || lado === 'sul') {
    const y = lado === 'norte' ? cama.y + cama.sizeY / 2 - item.sizeY / 2 : cama.y - cama.sizeY / 2 + item.sizeY / 2;
    const yaw = lado === 'norte' ? 0 : Math.PI;
    return [at(cama.x - cama.sizeX / 2 - meio, y, yaw), at(cama.x + cama.sizeX / 2 + meio, y, yaw)];
  }
  const x = lado === 'oeste' ? cama.x - cama.sizeX / 2 + item.sizeY / 2 : cama.x + cama.sizeX / 2 - item.sizeY / 2;
  const yaw = lado === 'oeste' ? Math.PI / 2 : -Math.PI / 2;
  return [at(x, cama.y + cama.sizeY / 2 + meio, yaw), at(x, cama.y - cama.sizeY / 2 - meio, yaw)];
}

const decoracoes = new WeakMap<HouseLayout, VisualFurniture[]>();
/**
 * Móveis decorativos (determinísticos e guardados por planta; não altere a lista devolvida).
 * Não modificam a planta; a navegação simulada desvia deles como de qualquer móvel.
 */
export function roomDecorations(layout: HouseLayout): VisualFurniture[] {
  let pronto = decoracoes.get(layout);
  if (!pronto) { pronto = calcularDecoracoes(layout); decoracoes.set(layout, pronto); }
  return pronto;
}

function calcularDecoracoes(layout: HouseLayout): VisualFurniture[] {
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
      ...pontoDaPessoa(r),
      sizeX: 0.7, sizeY: 0.7, height: 0
    }))
  ];
  const result: VisualFurniture[] = [];
  /** Móveis de verdade (sem portas, ponto da pessoa nem faixa da geladeira, que só reservam espaço). */
  const solidos = (): Furniture[] => [...layout.furniture, ...result];
  // Cadeira voltada à escrivaninha, parcialmente recolhida sob o tampo (a frente da mesa primeiro).
  const cadeira = (table: VisualFurniture) => {
    const room = layout.rooms.find(r => r.id === table.roomId);
    if (!room) return;
    const options = [
      { x: table.x, y: table.y - table.sizeY / 2 - 0.1, yaw: Math.PI },
      { x: table.x, y: table.y + table.sizeY / 2 + 0.1, yaw: 0 },
      { x: table.x - table.sizeX / 2 - 0.1, y: table.y, yaw: Math.PI / 2 },
      { x: table.x + table.sizeX / 2 + 0.1, y: table.y, yaw: -Math.PI / 2 }
    ];
    if (table.yaw != null) {
      // Decoração encostada na parede: a cadeira fica do lado de dentro do cômodo
      const frente = { x: Math.sin(table.yaw), y: -Math.cos(table.yaw) };
      options.sort((a, b) => ((b.x - table.x) * frente.x + (b.y - table.y) * frente.y) - ((a.x - table.x) * frente.x + (a.y - table.y) * frente.y));
    }
    for (const option of options) {
      const chair: VisualFurniture = { ...option, name: 'Cadeira', roomId: room.id, sizeX: 0.42, sizeY: 0.42, height: 0.9 };
      if (insideRoom(chair, room) && !reserved.some(other => other !== table && overlaps(chair, other)) &&
          !routes.some(([a, b]) => intersectsRoute(chair, a, b)) && circulacaoLivre(layout, room, [...solidos(), chair])) {
        result.push(chair);
        reserved.push(chair);
        return;
      }
    }
  };
  for (const table of layout.furniture.filter(f => /escrivaninha/i.test(f.name))) cadeira(table);
  for (const room of layout.rooms) {
    const cama = layout.furniture.find(f => f.roomId === room.id && /cama/i.test(f.name));
    const usados = new Set<string>();
    for (const item of itensDoComodo(layout, room)) {
      // Itens repetidos (dois criados-mudos) contam como um só na planta cadastrada
      if (!usados.has(item.name) && layout.furniture.some(f => f.roomId === room.id && f.name === item.name)) continue;
      usados.add(item.name);
      const positions = [...(/criado/i.test(item.name) && cama ? aoLadoDaCama(cama, room, item) : []), ...candidates(room, item)];
      // A geladeira fica preferencialmente na parede direita da cozinha.
      if (item.name === 'Geladeira') positions.sort((a, b) => b.x - a.x || b.y - a.y);
      const position = positions.find(f => insideRoom(f, room) &&
        !reserved.some(other => overlaps(f, other)) && !routes.some(([a, b]) => intersectsRoute(f, a, b)) &&
        (f.name !== 'Geladeira' || (insideRoom(fridgeAccess(f), room) &&
          !reserved.some(other => overlaps(fridgeAccess(f), other)))) &&
        circulacaoLivre(layout, room, [...solidos(), f])
      );
      if (position) {
        result.push(position);
        reserved.push(position);
        if (position.name === 'Geladeira') reserved.push(fridgeAccess(position));
        if (/escrivaninha/i.test(position.name)) cadeira(position);
      }
    }
  }
  // Casas maiores: mesa de centro entre o sofá e a TV
  for (const room of layout.rooms.filter(r => r.id === 'sala' && casaMaior(layout))) {
    const sofa = layout.furniture.find(f => f.roomId === room.id && /sof/i.test(f.name));
    const tv = layout.furniture.find(f => f.roomId === room.id && /rack/i.test(f.name));
    if (!sofa || !tv) continue;
    const deLado = sofa.sizeY > sofa.sizeX;
    const mesa: VisualFurniture = { name: 'Mesa de centro', roomId: room.id, height: 0.42,
      x: (sofa.x + tv.x) / 2, y: (sofa.y + tv.y) / 2, sizeX: deLado ? 0.5 : 0.9, sizeY: deLado ? 0.9 : 0.5, yaw: deLado ? Math.PI / 2 : 0 };
    if (insideRoom(mesa, room) && !reserved.some(other => overlaps(mesa, other, 0.2)) && circulacaoLivre(layout, room, [...solidos(), mesa])) {
      result.push(mesa);
      reserved.push(mesa);
    }
  }
  // Tapetes são superfícies planas abaixo das rotas e do LiDAR (2 cm).
  for (const room of layout.rooms.filter(r => /^(sala|quarto)(-|$)/.test(r.id))) {
    const sofa = layout.furniture.find(f => f.roomId === room.id && /sof/i.test(f.name));
    const tv = layout.furniture.find(f => f.roomId === room.id && /rack/i.test(f.name));
    const x = sofa && tv ? (sofa.x + tv.x) / 2 : (room.minX + room.maxX) / 2;
    const y = sofa && tv ? (sofa.y + tv.y) / 2 : (room.minY + room.maxY) / 2;
    const sizeX = Math.min(2.2, (room.maxX - room.minX) * 0.65);
    const sizeY = Math.min(1.65, (room.maxY - room.minY) * 0.55);
    result.push({ name: 'Tapete', roomId: room.id, height: 0.008, sizeX, sizeY,
      x: Math.max(room.minX + sizeX / 2 + 0.12, Math.min(room.maxX - sizeX / 2 - 0.12, x)),
      y: Math.max(room.minY + sizeY / 2 + 0.12, Math.min(room.maxY - sizeY / 2 - 0.12, y)) });
  }
  return result;
}
