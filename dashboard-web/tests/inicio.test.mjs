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

const base = async () => {
  const { FALLBACK_LAYOUT } = await modulo("../src/robot/houseLayout.ts");
  return {
    carregando: false,
    demo: false,
    alerts: [],
    layout: FALLBACK_LAYOUT,
    device: { deviceId: "AMP-1", name: "Dispositivo Amparo (José Silva)", isOnline: false, lastUpdate: null },
  };
};

test("Início after signup: house registered, devices not connected yet", async () => {
  const { resumoDoEstado } = await modulo("../src/lib/resumoDoEstado.ts");
  const r = resumoDoEstado({ ...(await base()), enderecoCadastrado: true });
  assert.equal(r.forte, "Tudo pronto.");
  assert.equal(r.apoio, " Agora é só conectar a bengala, a câmera e o robô.");
  assert.equal(r.acao, "equipamentos");
});

test("Início without an address still asks to set up the house", async () => {
  const { resumoDoEstado } = await modulo("../src/lib/resumoDoEstado.ts");
  const r = resumoDoEstado({ ...(await base()), enderecoCadastrado: false });
  assert.equal(r.forte, "Vamos configurar o acompanhamento.");
  assert.equal(r.acao, undefined);
});
