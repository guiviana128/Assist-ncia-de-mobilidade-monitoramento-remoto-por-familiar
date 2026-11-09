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
        assert.equal(l.rooms.length, 2 + bedrooms + bathrooms, nome);
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

