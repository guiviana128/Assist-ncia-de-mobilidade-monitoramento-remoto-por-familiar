import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
test("authenticated virtual robot is online and commands never reach the physical API", async () => {
  let requests = 0;
  const changes = [];
  const storage = new Map();
  const auth = {
    username: "first@example.test",
    generation: 1,
    isLoggedIn: () => true,
    onChange: (f) => {
      changes.push(f);
      return () => {};
    },
  };
  class ApiError extends Error {}
  class AuthRequiredError extends Error {}
  const apiJson = async (path) => {
    // As preferências da família (planta do modelo) não são o equipamento físico.
    if (path === "/care/preferences")
      return { floorPlanSource: "TEMPLATE", floorPlanTemplate: { kind: "HOUSE", bedrooms: 3, bathrooms: 2 } };
    requests++;
    throw Error("Physical endpoint must not be called");
  };
  const context = vm.createContext({
    performance,
    Date,
    Math,
    localStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
    },
    window: { setInterval: () => 1, clearInterval: () => {} },
    structuredClone,
  });
  const reactModule = new vm.SyntheticModule(
    ["useSyncExternalStore"],
    function () {
      this.setExport("useSyncExternalStore", () => {});
    },
    { context },
  );
  const authModule = new vm.SyntheticModule(
    ["auth", "ApiError", "AuthRequiredError", "apiJson"],
    function () {
      for (const [key, value] of Object.entries({
        auth,
        ApiError,
        AuthRequiredError,
        apiJson,
      }))
        this.setExport(key, value);
    },
    { context },
  );
  const cache = new Map();
  async function load(url) {
    if (url.pathname.endsWith("/services/auth.ts")) return authModule;
    if (url.pathname.endsWith("/react.ts")) return reactModule;
    if (cache.has(url.href)) return cache.get(url.href);
    const source = await readFile(url, "utf8");
    const mod = new vm.SourceTextModule(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      { context, identifier: url.href },
    );
    cache.set(url.href, mod);
    await mod.link((name, parent) =>
      name === "react"
        ? reactModule
        : load(new URL(name + ".ts", parent.identifier)),
    );
    return mod;
  }
  const p = await load(
    new URL("../src/services/presentation.ts", import.meta.url),
  );
  await p.evaluate();
  const r = await load(new URL("../src/services/robotApi.ts", import.meta.url));
  await r.evaluate();
  p.namespace.presentation.set("demo");
  // Espera as preferências carregarem: a demonstração usa a planta da família.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const layout = await r.namespace.robotApi.getLayout();
  assert.deepEqual(
    [...layout.rooms.map((room) => room.id)],
    ["sala", "cozinha", "quarto", "quarto-2", "quarto-3", "banheiro", "banheiro-2", "jantar"],
  );
  const state = await r.namespace.robotApi.getState();
  assert.equal(state.online, true);
  assert.equal(requests, 0);
  const mission = await r.namespace.robotApi.requestMission({
    type: "GO_TO_ROOM",
    targetRoom: "quarto-3",
  });
  assert.ok(mission.id);
  assert.equal(mission.targetRoom, "quarto-3");
  assert.equal(requests, 0);
  auth.username = "other@example.test";
  auth.generation++;
  changes.forEach((f) => f());
  assert.equal(p.namespace.presentation.get(), "real");
  await assert.rejects(() => r.namespace.robotApi.getState());
  assert.equal(requests, 1);
});
