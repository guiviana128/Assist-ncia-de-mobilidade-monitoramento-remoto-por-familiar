import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(
  new URL("../src/services/auth.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
async function client(local = storage(), tab = storage()) {
  const context = vm.createContext({
    localStorage: local,
    sessionStorage: tab,
    Headers,
    AbortSignal,
    fetch: async () =>
      new Response(
        JSON.stringify({
          token: "valid-token",
          username: "familia@example.test",
          deviceId: "device-1",
          deviceKey: "key",
          robotId: "robot-1",
          recoveryCode: "recovery",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  const module = new vm.SourceTextModule(js, {
    context,
    initializeImportMeta: (meta) => {
      meta.env = {};
    },
  });
  await module.link(() => {
    throw new Error("Unexpected import");
  });
  await module.evaluate();
  return module.namespace.auth;
}
test("a new account remembers the session when keep signed in is selected", async () => {
  const local = storage(),
    tab = storage();
  const auth = await client(local, tab);
  await auth.register(
    "Maria",
    "familia@example.test",
    "SenhaForte123!",
    "José",
    "",
    true,
  );
  assert.ok(local.getItem("amparo_session"));
  assert.equal(tab.getItem("amparo_session"), null);
  const reopened = await client(local, storage());
  assert.equal(reopened.isLoggedIn(), true);
});
test("a new account without keep signed in stays only in the current tab", async () => {
  const local = storage(),
    tab = storage();
  const auth = await client(local, tab);
  await auth.register(
    "Maria",
    "familia@example.test",
    "SenhaForte123!",
    "José",
    "",
    false,
  );
  assert.equal(local.getItem("amparo_session"), null);
  assert.ok(tab.getItem("amparo_session"));
  assert.equal((await client(local, storage())).isLoggedIn(), false);
});
test("a browser storage error does not report successful registration as a server failure", async () => {
  const blocked = {
    getItem: () => null,
    removeItem: () => {},
    setItem: () => {
      throw new Error("Quota exceeded");
    },
  };
  const auth = await client(blocked, blocked);
  await auth.register(
    "Maria",
    "familia@example.test",
    "SenhaForte123!",
    "José",
    "",
    true,
  );
  assert.equal(auth.isLoggedIn(), true);
  assert.ok(auth.persistenceWarning);
});
test("a saved login is recovered even if tab storage is unavailable", async () => {
  const local = storage({
    amparo_session: JSON.stringify({
      token: "valid-token",
      username: "familia@example.test",
    }),
  });
  const blocked = {
    getItem: () => {
      throw new Error("Blocked");
    },
    removeItem: () => {},
    setItem: () => {},
  };
  assert.equal((await client(local, blocked)).isLoggedIn(), true);
});
