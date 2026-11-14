import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

// Carrega um módulo .ts de src resolvendo os imports relativos (só tipos e funções puras).
const contexto = vm.createContext({});
const cache = new Map();
async function load(url) {
  const chave = url.href;
  if (cache.has(chave)) return cache.get(chave);
  const source = await readFile(url, "utf8");
  const mod = new vm.SourceTextModule(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { context: contexto, identifier: chave },
  );
  cache.set(chave, mod);
  await mod.link(async (spec) => {
    if (!spec.startsWith(".")) throw Error(`Dependência externa: ${spec}`);
    return load(new URL(spec.endsWith(".ts") ? spec : `${spec}.ts`, url));
  });
  return mod;
}
const modulo = async (path) => {
  const mod = await load(new URL(path, import.meta.url));
  if (mod.status !== "evaluated") await mod.evaluate();
  return mod.namespace;
};


const dentro = (r, x, y) => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;

test('robot avoids solid furniture and walls in every furnished house', async () => {
  const { layoutDoModelo, FALLBACK_LAYOUT } = await modulo('../src/robot/houseLayout.ts');
  const { planRobotPath, robotSegmentClear } = await modulo('../src/robot/furnitureNavigation.ts');
  const layouts = [FALLBACK_LAYOUT];
  for (const kind of ['HOUSE', 'APARTMENT']) for (let bedrooms = 1; bedrooms <= 4; bedrooms++)
    for (let bathrooms = 1; bathrooms <= 3; bathrooms++) layouts.push(layoutDoModelo({ kind, bedrooms, bathrooms }));
  for (const layout of layouts) {
    let from = layout.dock;
    for (const room of layout.rooms) {
      const path = planRobotPath(layout, from, { x: room.targetX, y: room.targetY });
      assert.ok(path.length >= 2, `${layout.name}: ${room.id} is reachable`);
      const end = path.at(-1);
      assert.ok(dentro(room, end.x, end.y));
      for (let i = 1; i < path.length; i++) assert.ok(robotSegmentClear(layout, path[i - 1], path[i]), `${room.id}: unsafe segment`);
      from = end;
    }
  }
  const blocked = { ...FALLBACK_LAYOUT, walls: [...FALLBACK_LAYOUT.walls, { x1: 3, y1: -3, x2: 3, y2: 1 }] };
  assert.equal(planRobotPath(blocked, blocked.dock, { x: 5.5, y: -1 }).length, 0, 'never fall back to crossing a closed wall');
});

test('simulated activities have realistic intervals, variety and numbered rooms', async () => {
  const { atividades, atividadesSimuladas, intervaloAtividade } = await modulo('../src/lib/activities.ts');
  const rooms = ['sala', 'cozinha', 'quarto-2', 'escritorio'];
  const input = Array.from({ length: 2000 }, (_, i) => ({ comodo: rooms[i % rooms.length], quando: 1700000000000 + i * 15000 }));
  const result = [...atividadesSimuladas(input)].reverse();
  assert.ok(result.length < 100);
  assert.ok(new Set(result.map(r => r.atividade)).size >= 8);
  assert.ok(Object.keys(atividades).length >= 15);
  for (let i = 1; i < result.length; i++) assert.ok(result[i].quando - result[i - 1].quando >= intervaloAtividade(result[i - 1].atividade));
  assert.equal(atividadesSimuladas([{ comodo: 'quarto-3', quando: 1 }])[0].atividade, 'descanso');
});

test("floor plan from the chosen model: rooms, doors, furniture and dock", async () => {
  const { layoutDoModelo, planPath } = await modulo("../src/robot/houseLayout.ts");
  const l = layoutDoModelo({ kind: "HOUSE", bedrooms: 2, bathrooms: 1 });
  assert.deepEqual([...l.rooms.map((r) => r.id)], ["sala", "cozinha", "quarto", "quarto-2", "banheiro"]);
  assert.deepEqual([...l.rooms.map((r) => r.name)], ["Sala de estar", "Cozinha", "Quarto", "Quarto 2", "Banheiro"]);
  assert.equal(l.rooms.some((r) => r.id === "escritorio"), false);
  assert.match(l.name, /Casa térrea · 2 quartos e 1 banheiro/);
  // A rota prevista usa as portas da planta gerada: da sala ao quarto 2 passa pela porta dele.
  const q2 = l.rooms[3];
  const rota = planPath(l, { x: l.dock.x, y: l.dock.y }, { x: q2.targetX, y: q2.targetY });
  assert.ok(rota.length >= 3, "a rota atravessa ao menos uma porta");
});

test("every model is a valid house: no overlaps, all rooms reachable, inside the backend limits", async () => {
  const { layoutDoModelo } = await modulo("../src/robot/houseLayout.ts");
  for (const kind of ["HOUSE", "APARTMENT"])
    for (let bedrooms = 1; bedrooms <= 4; bedrooms++)
      for (let bathrooms = 1; bathrooms <= 3; bathrooms++) {
        const l = layoutDoModelo({ kind, bedrooms, bathrooms });
        const nome = `${kind} ${bedrooms}q ${bathrooms}b`;
        const frente = l.rooms.filter((r) => r.id === "jantar" || r.id === "servico").length;
        assert.equal(l.rooms.length, 2 + bedrooms + bathrooms + frente, nome);
        assert.ok(l.walls.length <= 80 && l.furniture.length <= 40 && l.doors.length <= 30, nome);
        for (const r of l.rooms) {
          assert.ok(r.minX < r.maxX && r.minY < r.maxY && dentro(r, r.targetX, r.targetY), `${nome}: ${r.id}`);
          assert.match(r.id, /^[a-z]{2,20}(-[0-9]{1,2})?$/);
        }
        for (let i = 0; i < l.rooms.length; i++)
          for (let j = i + 1; j < l.rooms.length; j++) {
            const a = l.rooms[i], b = l.rooms[j];
            const sobrepoe = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
            assert.equal(sobrepoe, false, `${nome}: ${a.id} x ${b.id}`);
          }
        for (const f of l.furniture) {
          const r = l.rooms.find((x) => x.id === f.roomId);
          assert.ok(r && dentro(r, f.x, f.y), `${nome}: ${f.name} em ${f.roomId}`);
        }
        assert.equal(l.rooms.find((r) => dentro(r, l.dock.x, l.dock.y))?.id, "sala", nome);
        // Todos os cômodos alcançáveis pelas portas a partir da sala
        const vistos = new Set(["sala"]);
        for (let mudou = true; mudou; ) {
          mudou = false;
          for (const d of l.doors)
            for (const [x, y] of [[d.a, d.b], [d.b, d.a]])
              if (vistos.has(x) && !vistos.has(y)) { vistos.add(y); mudou = true; }
        }
        assert.equal(vistos.size, l.rooms.length, nome);
        assert.ok(JSON.stringify(l).length < 6000, `${nome}: cabe nas preferências`);
        for (const v of JSON.stringify(l).match(/-?\d+(\.\d+)?/g)) assert.ok(Math.abs(Number(v)) <= 50);
      }
});

test("demo robot patrols the family's plan and the person never walks into a bathroom", async () => {
  const { layoutDoModelo, comodosDaPessoa, chavePlanta } = await modulo("../src/robot/houseLayout.ts");
  const { DemoRobot } = await modulo("../src/robot/demoRobot.ts");
  const l = layoutDoModelo({ kind: "HOUSE", bedrooms: 3, bathrooms: 2 });
  assert.deepEqual([...l.rooms.map((r) => r.name)], ["Sala de estar", "Cozinha", "Quarto", "Quarto 2", "Quarto 3", "Banheiro", "Banheiro 2", "Sala de jantar"]);
  assert.deepEqual([...comodosDaPessoa(l)], ["sala", "cozinha", "quarto", "quarto-2", "quarto-3", "jantar"]);
  assert.notEqual(chavePlanta(l), chavePlanta(layoutDoModelo({ kind: "HOUSE", bedrooms: 2, bathrooms: 1 })));

  const robo = new DemoRobot(l, "DEMO");
  const vistos = new Set();
  for (let i = 0; i < 2400; i++) {
    robo.tick(0.5);
    const room = robo.getState().currentRoom;
    if (room) vistos.add(room);
  }
  // A patrulha passa pelos cômodos da planta gerada (incluindo os de id "-2", "-3").
  for (const id of ["quarto-2", "quarto-3", "banheiro-2"]) assert.ok(vistos.has(id), `patrulha passou por ${id}`);
  assert.equal([...vistos].some((id) => id === "escritorio"), false);
  const m = robo.request({ type: "GO_TO_ROOM", targetRoom: "quarto-3" });
  assert.equal(m.targetRoom, "quarto-3");
  assert.throws(() => robo.request({ type: "GO_TO_ROOM", targetRoom: "escritorio" }));
});

test("3D decoration preserves the map, fridge access and rugs in every bedroom", async () => {
  const { layoutDoModelo, FALLBACK_LAYOUT } = await modulo("../src/robot/houseLayout.ts");
  const { roomDecorations, fridgeAccess } = await modulo("../src/components/house3d/decorations.ts");
  const layouts = [FALLBACK_LAYOUT];
  for (const kind of ["HOUSE", "APARTMENT"])
    for (let bedrooms = 1; bedrooms <= 4; bedrooms++)
      for (let bathrooms = 1; bathrooms <= 3; bathrooms++)
        layouts.push(layoutDoModelo({ kind, bedrooms, bathrooms }));
  for (const layout of layouts) {
    const original = JSON.stringify(layout);
    const decorations = roomDecorations(layout);
    assert.equal(JSON.stringify(layout), original, "visual decoration must not mutate navigation data");
    const fridges = decorations.filter(f => f.name === "Geladeira");
    assert.equal(fridges.length, 1);
    for (const fridge of fridges) {
      const access = fridgeAccess(fridge);
      const room = layout.rooms.find(r => r.id === fridge.roomId);
      assert.ok(dentro(room, access.x - access.sizeX / 2, access.y - access.sizeY / 2));
      assert.ok(dentro(room, access.x + access.sizeX / 2, access.y + access.sizeY / 2));
      for (const other of [...layout.furniture, ...decorations]) {
        if (other === fridge || other.name === "Tapete") continue;
        const blocked = Math.abs(access.x - other.x) < (access.sizeX + other.sizeX) / 2 &&
          Math.abs(access.y - other.y) < (access.sizeY + other.sizeY) / 2;
        assert.equal(blocked, false, `${layout.name}: ${other.name} blocks the fridge`);
      }
    }
    for (const room of layout.rooms.filter(r => /^(sala|quarto)(-|$)/.test(r.id))) {
      const rug = decorations.find(f => f.name === "Tapete" && f.roomId === room.id);
      assert.ok(rug, `missing rug in ${room.id}`);
      assert.ok(rug.height < 0.02, "rugs remain below the LiDAR overlay");
    }
  }
});

const todasAsPlantas = async () => {
  const { layoutDoModelo, FALLBACK_LAYOUT } = await modulo('../src/robot/houseLayout.ts');
  const layouts = [FALLBACK_LAYOUT];
  for (const kind of ['HOUSE', 'APARTMENT']) for (let bedrooms = 1; bedrooms <= 4; bedrooms++)
    for (let bathrooms = 1; bathrooms <= 3; bathrooms++) layouts.push(layoutDoModelo({ kind, bedrooms, bathrooms }));
  return layouts;
};

test('living room stays proportional and the extra front space becomes useful rooms', async () => {
  const { layoutDoModelo } = await modulo('../src/robot/houseLayout.ts');
  for (const layout of (await todasAsPlantas()).slice(1)) {
    const sala = layout.rooms.find(r => r.id === 'sala');
    const largura = sala.maxX - sala.minX, fundo = sala.maxY - sala.minY;
    assert.ok(largura <= 6.5 + 1e-9 && largura / fundo <= 2, `${layout.name}: sala ${largura} x ${fundo}`);
    // A frente é coberta sem buracos: sala, [jantar], cozinha, [serviço]
    const frente = layout.rooms.filter(r => r.minY === sala.minY).sort((a, b) => a.minX - b.minX);
    for (let i = 1; i < frente.length; i++) {
      assert.equal(frente[i].minX, frente[i - 1].maxX);
      assert.ok(layout.doors.some(d => [d.a, d.b].includes(frente[i].id) && [d.a, d.b].includes(frente[i - 1].id)), 'porta entre vizinhos da frente');
    }
    assert.ok(Math.abs(frente.at(-1).maxX - frente[0].minX - layout.width) < 1e-9);
    if (layout.rooms.some(r => r.id === 'servico')) assert.ok(layout.rooms.some(r => r.id === 'jantar'), 'a sala de jantar vem antes');
  }
  const grande = layoutDoModelo({ kind: 'HOUSE', bedrooms: 3, bathrooms: 2 });
  assert.ok(grande.rooms.some(r => r.id === 'jantar' && r.name === 'Sala de jantar'));
  const enorme = layoutDoModelo({ kind: 'HOUSE', bedrooms: 4, bathrooms: 3 });
  assert.ok(enorme.rooms.some(r => r.id === 'servico' && r.name === 'Lavanderia'));
  assert.ok(layoutDoModelo({ kind: 'APARTMENT', bedrooms: 4, bathrooms: 3 }).rooms.some(r => r.name === 'Área de serviço'));
  // Modelo mínimo: igual ao de antes (sala de 4 m e cozinha de 3 m)
  const minimo = layoutDoModelo({ kind: 'HOUSE', bedrooms: 1, bathrooms: 1 });
  assert.equal(JSON.stringify(minimo.rooms.map(r => [r.id, r.maxX - r.minX]).slice(0, 2)), JSON.stringify([['sala', 4], ['cozinha', 3]]));
});

test('each bedroom and bathroom has its own style; extra living-room decor only in bigger homes', async () => {
  const { layoutDoModelo } = await modulo('../src/robot/houseLayout.ts');
  const { roomDecorations } = await modulo('../src/components/house3d/decorations.ts');
  const estilo = (layout, deco, id) => JSON.stringify([
    ...layout.furniture.filter(f => f.roomId === id).map(f => [f.name, f.sizeX, f.sizeY, +(f.x - layout.rooms.find(r => r.id === id).minX).toFixed(1)]),
    ...deco.filter(f => f.roomId === id && f.name !== 'Tapete').map(f => f.name).sort()]);
  const l = layoutDoModelo({ kind: 'HOUSE', bedrooms: 4, bathrooms: 3 });
  const deco = roomDecorations(l);
  const quartos = l.rooms.filter(r => r.id.startsWith('quarto')).map(r => estilo(l, deco, r.id));
  const banheiros = l.rooms.filter(r => r.id.startsWith('banheiro')).map(r => estilo(l, deco, r.id));
  assert.equal(new Set(quartos).size, 4, quartos.join('\n'));
  assert.equal(new Set(banheiros).size, 3, banheiros.join('\n'));
  assert.equal(deco.filter(f => f.roomId === 'banheiro-3' && /chuveiro/i.test(f.name)).length, 0, 'lavabo sem box');
  assert.equal(deco.filter(f => f.roomId === 'quarto' && /criado/i.test(f.name)).length, 2, 'casal com dois criados-mudos');
  assert.ok(deco.some(f => f.roomId === 'quarto-2' && f.name === 'Cadeira'), 'escrivaninha com cadeira');
  // Determinístico
  assert.equal(JSON.stringify(roomDecorations(layoutDoModelo({ kind: 'HOUSE', bedrooms: 4, bathrooms: 3 }))), JSON.stringify(deco));

  const extras = ['Estante de livros', 'Luminária de chão', 'Mesa de centro'];
  for (const layout of await todasAsPlantas()) {
    const nomes = roomDecorations(layout).filter(f => f.roomId === 'sala').map(f => f.name);
    const maior = layout.rooms.filter(r => r.id.startsWith('quarto')).length > 1 || layout.rooms.filter(r => r.id.startsWith('banheiro')).length > 1;
    for (const nome of extras) assert.equal(nomes.includes(nome), maior, `${layout.name}: ${nome}`);
    if (layout.rooms.some(r => r.id === 'jantar')) {
      assert.ok(layout.furniture.some(f => f.roomId === 'jantar' && /mesa/i.test(f.name)));
      assert.ok(roomDecorations(layout).some(f => f.roomId === 'jantar' && f.name === 'Aparador'), `${layout.name}: aparador`);
    }
  }
});

test('the person never walks through walls or furniture and goes through the middle of doors', async () => {
  const { planPersonPath, pontoLivreDaPessoa, pessoaLivre, pessoaTrechoLivre, pontoLivre } = await modulo('../src/robot/furnitureNavigation.ts');
  const { roomDecorations } = await modulo('../src/components/house3d/decorations.ts');
  const { DOORS } = await modulo('../src/robot/houseLayout.ts');
  for (const layout of await todasAsPlantas()) {
    const doors = layout.doors ?? DOORS;
    // Nenhum móvel bloqueia porta
    for (const d of doors) assert.ok(pessoaLivre(layout, d), `${layout.name}: porta ${d.a}/${d.b} bloqueada`);
    const pontos = layout.rooms.map(r => {
      const p = pontoLivreDaPessoa(layout, r);
      assert.ok(dentro(r, p.x, p.y) && pessoaLivre(layout, p), `${layout.name}: ponto da pessoa em ${r.id}`);
      return p;
    });
    for (let i = 0; i < pontos.length; i++) for (let j = 0; j < pontos.length; j++) {
      if (i === j) continue;
      const path = planPersonPath(layout, pontos[i], pontos[j]);
      const nome = `${layout.name}: ${layout.rooms[i].id} → ${layout.rooms[j].id}`;
      assert.ok(path.length >= 2, `${nome} sem caminho`);
      for (let k = 1; k < path.length; k++) assert.ok(pessoaTrechoLivre(layout, path[k - 1], path[k]), `${nome}: atravessa algo`);
      // Toda troca de cômodo acontece exatamente no meio de uma porta
      for (let k = 1; k < path.length; k++) {
        const a = path[k - 1], b = path[k];
        const ra = layout.rooms.filter(r => dentro(r, a.x, a.y)), rb = layout.rooms.filter(r => dentro(r, b.x, b.y));
        if (!ra.some(r => rb.includes(r))) assert.fail(`${nome}: trecho entre cômodos sem passar pela porta`);
      }
      const portas = path.filter(p => doors.some(d => Math.hypot(d.x - p.x, d.y - p.y) < 1e-6));
      if (layout.rooms[i].id !== layout.rooms[j].id) assert.ok(portas.length >= 1, `${nome}: não passa pelo meio de uma porta`);
    }
    // Parada em cima de um móvel: reposiciona no ponto livre mais próximo
    for (const f of [...layout.furniture, ...roomDecorations(layout)].filter(f => f.height > 0.05)) {
      const livre = pontoLivre(layout, { x: f.x, y: f.y });
      assert.ok(pessoaLivre(layout, livre), `${layout.name}: ${f.name}`);
    }
  }
});
