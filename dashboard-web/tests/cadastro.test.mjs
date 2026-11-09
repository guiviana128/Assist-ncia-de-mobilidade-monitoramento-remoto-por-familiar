import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { context: vm.createContext({}) },
  );
  await mod.link(() => {
    throw Error("Unexpected dependency");
  });
  await mod.evaluate();
  return mod.namespace;
}
const regras = () => load("../src/components/cadastro/regras.ts");

test("password strength lights 4 segments and never passes 'Curta' under 12 characters", async () => {
  const r = await regras();
  assert.deepEqual({ ...r.forcaSenha("") }, { nivel: 0, rotulo: "" });
  assert.equal(r.forcaSenha("Abc123!xyz").nivel, 1);
  assert.equal(r.forcaSenha("abcdefghijkl").rotulo, "Fraca");
  // Figma: "Boa · 14 caracteres" com 3 segmentos
  assert.deepEqual({ ...r.forcaSenha("SenhaForte123!") }, { nivel: 3, rotulo: "Boa" });
  assert.equal(r.forcaSenha("SenhaMaisForte123!").nivel, 4);
});

test("brazilian phones follow the same rule as the backend", async () => {
  const r = await regras();
  for (const ok of ["(11) 98123-4567", "11 3123-4567", "+55 11 98123-4567", "1198123-4567"])
    assert.equal(r.telefoneValido(ok), true, ok);
  for (const ruim of ["1234", "(11) 88123-4567", "(01) 98123-4567", "11 98123-45678", "abc"])
    assert.equal(r.telefoneValido(ruim), false, ruim);
  assert.equal(r.formatarTelefone("11981234567"), "(11) 98123-4567");
  assert.equal(r.formatarTelefone("1131234567"), "(11) 3123-4567");
  assert.equal(r.formatarTelefone("119"), "(11) 9");
  assert.equal(r.discagem("(11) 98123-4567"), "+5511981234567");
});

test("invite users skip steps 2 to 6", async () => {
  const r = await regras();
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8].filter((p) => r.passoPulado(p, true)),
    [2, 3, 4, 5, 6],
  );
  assert.equal(r.passoPulado(3, false), false);
});

test("step validation reports each invalid field", async () => {
  const r = await regras();
  assert.deepEqual(
    Object.keys(r.validarConta({ nome: "", email: "x", senha: "curta", porConvite: true, convite: "" })).sort(),
    ["convite", "email", "nome", "senha"],
  );
  assert.deepEqual(
    { ...r.validarConta({ nome: "Maria", email: "maria@email.com", senha: "SenhaForte123!", porConvite: false }) },
    {},
  );
  const pessoa = r.validarPessoa({ nome: "José", telefone: "(11) 98123-4567", moraSozinho: false, moradores: [] });
  assert.deepEqual(Object.keys(pessoa), ["moradorNome"]);
  assert.ok(r.validarMorador({ name: "Ana", relation: "" }, 10).moradorNome);
  assert.deepEqual(
    Object.keys(r.validarConsentimento({ quem: "GUARDIAN", responsavel: " ", concorda: false })).sort(),
    ["concorda", "responsavel"],
  );
  assert.deepEqual({ ...r.validarConsentimento({ quem: "SELF", responsavel: "", concorda: true }) }, {});
});

test("bathrooms are always blocked from the camera", async () => {
  const r = await regras();
  assert.equal(r.ehBanheiro("banheiro"), true);
  assert.equal(r.ehBanheiro("banheiro-2"), true);
  assert.equal(r.ehBanheiro("lavabo"), true);
  assert.equal(r.ehBanheiro("sala"), false);
});
