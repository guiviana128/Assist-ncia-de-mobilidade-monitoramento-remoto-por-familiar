import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
test("failed preference loading cannot overwrite existing care data", async () => {
  const source = await readFile(
    new URL("../src/lib/cuidado.ts", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({ structuredClone });
  let fail = true;
  let written;
  const apiJson = async (path, options) => {
    if (options?.method === "PUT") {
      written = JSON.parse(options.body);
      return written;
    }
    if (fail) throw Error("offline");
    return {
      endereco: "Endereço preservado",
      remedios: [
        { id: 1, nome: "Lembrete existente", hora: "08:00", ativo: true },
      ],
      contatos: [],
    };
  };
  const auth = {
    generation: 1,
    isLoggedIn: () => true,
    onChange: () => () => {},
  };
  const dependencies = {
    react: new vm.SyntheticModule(
      ["useSyncExternalStore"],
      function () {
        this.setExport("useSyncExternalStore", () => {});
      },
      { context },
    ),
    "../services/auth": new vm.SyntheticModule(
      ["auth", "apiJson"],
      function () {
        this.setExport("auth", auth);
        this.setExport("apiJson", apiJson);
      },
      { context },
    ),
  };
  const mod = new vm.SourceTextModule(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { context },
  );
  await mod.link((name) => dependencies[name]);
  await mod.evaluate();
  const care = mod.namespace.cuidado;
  await care.recarregar();
  assert.equal(care.pronto(), false);
  const home = {
    version: 1,
    address: { street: "Praça da Sé", number: "1", city: "São Paulo" },
    lat: -23.55,
    lng: -46.63,
    radius: 500,
    confirmed: true,
  };
  assert.equal(await care.definirCasa(home), false);
  assert.equal(written, undefined);
  fail = false;
  await care.recarregar();
  assert.equal(care.pronto(), true);
  assert.equal(await care.definirCasa(home), true);
  assert.equal(written.remedios[0].nome, "Lembrete existente");
});
