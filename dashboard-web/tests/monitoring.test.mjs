import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
test("connections expire independently and cannot stay online after a server error", async () => {
  const m = await load("../src/lib/monitoring.ts");
  const now = Date.now();
  const c = { online: true, lastSeen: new Date(now - 10000).toISOString() };
  assert.equal(m.connectionOnline("robot", c, false, now), false);
  assert.equal(m.connectionOnline("camera", c, false, now), true);
  assert.equal(m.connectionOnline("cane", c, true, now), false);
  assert.equal(
    m.connectionOnline(
      "vision",
      { ...c, lastSeen: new Date(now - 21000).toISOString() },
      false,
      now,
    ),
    false,
  );
  assert.notEqual(m.modeKey("a@example.test"), m.modeKey("b@example.test"));
});
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { context: vm.createContext({ URLSearchParams, AbortSignal, fetch }) },
  );
  await mod.link(() => {
    throw Error("Unexpected dependency");
  });
  await mod.evaluate();
  return mod.namespace;
}
test("home validation refuses missing address, invalid coordinates and unconfirmed point", async () => {
  const m = await load("../src/lib/monitoring.ts");
  const a = {
    street: "Rua Exemplo",
    number: "10",
    district: "Centro",
    city: "São Paulo",
    state: "SP",
    cep: "01001000",
    complement: "",
  };
  assert.equal(m.homeValid(a, { lat: -23.55, lng: -46.63 }, true), true);
  assert.equal(m.homeValid(a, { lat: 0, lng: 0 }, true), false);
  assert.equal(m.homeValid(a, { lat: -23.55, lng: -46.63 }, false), false);
  assert.equal(
    m.homeValid({ ...a, street: "" }, { lat: -23.55, lng: -46.63 }, true),
    false,
  );
  assert.equal(
    m.homeValid({ ...a, state: "RJ" }, { lat: -23.55, lng: -46.63 }, true),
    false,
  );
});
test("activity never calls old readings current or invents indoor walking", async () => {
  const m = await load("../src/lib/monitoring.ts");
  const now = Date.now();
  assert.equal(
    m.activityText({ state: "WAITING", personName: "José" }),
    "Aguardando a primeira leitura de José",
  );
  assert.match(
    m.activityText({ state: "STALE", personName: "José" }),
    /Última observação/,
  );
  assert.equal(
    m.activityText({ state: "MOVEMENT", personName: "José" }),
    "Movimento registrado para José",
  );
  assert.doesNotMatch(
    m.activityText({ state: "MOVEMENT", personName: "José" }),
    /caminhando/,
  );
  assert.equal(
    m.readingFresh(new Date(now - 121000).toISOString(), now),
    false,
  );
  assert.equal(m.readingFresh(new Date(now - 1000).toISOString(), now), true);
});
test("postal lookup rejects errors and other states instead of saving a false address", async () => {
  const m = await load("../src/services/address.ts");
  await assert.rejects(
    () =>
      m.lookupCep("000", async () => {
        throw Error("must not fetch");
      }),
    /8 dígitos/,
  );
  await assert.rejects(
    () =>
      m.lookupCep(
        "01001000",
        async () => new Response(JSON.stringify({ erro: true })),
      ),
    /não encontrado/,
  );
  await assert.rejects(
    () =>
      m.lookupCep(
        "01001000",
        async () => new Response(JSON.stringify({ uf: "RJ" })),
      ),
    /São Paulo/,
  );
  const result = await m.lookupCep(
    "01001-000",
    async () =>
      new Response(
        JSON.stringify({
          uf: "SP",
          logradouro: "Praça da Sé",
          localidade: "São Paulo",
          bairro: "Sé",
          cep: "01001-000",
        }),
      ),
  );
  assert.equal(result.street, "Praça da Sé");
  assert.equal(result.city, "São Paulo");
});
