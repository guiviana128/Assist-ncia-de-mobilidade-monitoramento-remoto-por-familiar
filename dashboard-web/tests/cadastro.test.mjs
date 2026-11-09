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

test("address step: CEP mask, São Paulo bounds and confirmation", async () => {
  const r = await regras();
  assert.equal(r.formatarCep("01310100"), "01310-100");
  assert.equal(r.formatarCep("0131"), "0131");
  assert.equal(r.pontoEmSP(-23.55, -46.63), true);
  assert.equal(r.pontoEmSP(-22.9, -43.2), false); // Rio de Janeiro
  const end = { cep: "01310-100", street: "Avenida Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo" };
  const ponto = { lat: -23.56, lng: -46.65 };
  assert.deepEqual({ ...r.validarEndereco(end, ponto, true) }, {});
  assert.deepEqual(Object.keys(r.validarEndereco(end, ponto, false)), ["confirmado"]);
  assert.deepEqual(Object.keys(r.validarEndereco(end, null, true)), ["mapa"]);
  assert.match(r.validarEndereco(end, { lat: -22.9, lng: -43.2 }, true).mapa, /São Paulo/);
  assert.deepEqual(
    Object.keys(r.validarEndereco({ ...end, cep: "123", street: " ", number: "", city: "" }, ponto, true)).sort(),
    ["cep", "city", "number", "street"],
  );
});

test("emergency contact needs a name and a valid phone; relation is optional", async () => {
  const r = await regras();
  assert.deepEqual({ ...r.validarContato({ nome: "Maria", parentesco: "", telefone: "(21) 99876-5432" }) }, {});
  assert.deepEqual(
    Object.keys(r.validarContato({ nome: "", parentesco: "", telefone: "(21) 1234" })).sort(),
    ["contatoNome", "contatoTelefone"],
  );
  assert.equal(r.CAMERA_PADRAO.has("sala"), true);
  assert.equal(r.CAMERA_PADRAO.has("banheiro"), false);
});

test("accounts created before the wizard resume at the first incomplete step", async () => {
  const r = await regras();
  const consent = { termsVersion: r.TERMO_VERSAO };
  const familia = [{ id: "familia-1" }, { id: "samu" }];
  assert.equal(r.primeiroPassoIncompleto({ contatos: [] }), 2);
  assert.equal(r.primeiroPassoIncompleto({ personPhone: "(11) 98123-4567", contatos: familia }), 3);
  assert.equal(
    r.primeiroPassoIncompleto({ personPhone: "(11) 98123-4567", consent: { termsVersion: "antigo" }, contatos: familia }),
    3,
  );
  assert.equal(r.primeiroPassoIncompleto({ personPhone: "(11) 98123-4567", consent, contatos: [{ id: "samu" }, { id: "bombeiros" }] }), 6);
  assert.equal(r.primeiroPassoIncompleto({ personPhone: "(11) 98123-4567", consent, contatos: familia }), null);
  // Conta antiga não gera códigos novos (passo 7): a chave dos equipamentos continua valendo.
  assert.equal(r.passoPulado(7, false, true), true);
  assert.equal(r.passoPulado(6, false, true), false);
});
