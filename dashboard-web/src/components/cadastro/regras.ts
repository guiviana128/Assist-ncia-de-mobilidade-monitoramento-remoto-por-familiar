// Regras do cadastro em 8 passos: textos da trilha, validação e formatação.
// Sem React aqui, para os testes (tests/cadastro.test.mjs) carregarem o arquivo direto.

/** Versão do termo de consentimento (o backend recusa outra). */
export const TERMO_VERSAO = "2026-11";
export const TOTAL_PASSOS = 8;
export const MAX_MORADORES = 10;
export const MAX_NOME = 100;
/** onboardingStep = 9: cadastro concluído. */
export const CADASTRO_CONCLUIDO = 9;

export interface MetaPasso {
  titulo: string;
  detalhe: string;
}

/** Trilha (Figma 43:3393 e seguintes). */
export const PASSOS: MetaPasso[] = [
  { titulo: "Sua conta", detalhe: "Nome, e-mail e senha" },
  { titulo: "Quem você acompanha", detalhe: "Nome, telefone e quem mora junto" },
  { titulo: "Consentimento", detalhe: "O que é monitorado e quem vê" },
  { titulo: "Endereço", detalhe: "CEP e ponto no mapa" },
  { titulo: "Planta da casa", detalhe: "Robô, modelo ou exemplo" },
  { titulo: "Avisos e câmera", detalhe: "Contato e cômodos que podem ser filmados" },
  { titulo: "Guardar o acesso", detalhe: "Código de recuperação e chave" },
  { titulo: "Começar", detalhe: "Equipamentos ou demonstração" },
];

/** Quem entra por convite pula os passos 2 a 6: a família já existe. */
export const passoPulado = (passo: number, convite: boolean) =>
  convite && passo >= 2 && passo <= 6;

export type Erros = Record<string, string>;

export const soDigitos = (s: string) => s.replace(/\D/g, "");

export const primeiroNome = (nome: string, padrao = "ele") =>
  nome.trim().split(/\s+/)[0] || padrao;

export const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

export interface Forca {
  /** 0 a 4 segmentos acesos. */
  nivel: number;
  rotulo: string;
}

/** Força da senha em 4 níveis. Abaixo de 12 caracteres nunca passa de "Curta". */
export function forcaSenha(senha: string): Forca {
  if (!senha) return { nivel: 0, rotulo: "" };
  if (senha.length < 12) return { nivel: 1, rotulo: "Curta" };
  let nivel = 1;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) nivel++;
  if (/\d/.test(senha) || /[^A-Za-z0-9]/.test(senha)) nivel++;
  if (senha.length >= 16) nivel++;
  nivel = Math.min(4, nivel);
  return { nivel, rotulo: ["", "Fraca", "Razoável", "Boa", "Forte"][nivel]! };
}

/** Mesma regra do backend: DDD + 8 ou 9 dígitos; celular começa com 9. */
export function telefoneValido(valor: string): boolean {
  if (!/^[0-9()+\-\s.]{8,20}$/.test(valor)) return false;
  let d = soDigitos(valor);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return false;
  if (d[0] === "0" || d[1] === "0") return false;
  return d.length === 10 || d[2] === "9";
}

/** Máscara enquanto digita: (11) 98123-4567 ou (11) 3123-4567. */
export function formatarTelefone(valor: string): string {
  let d = soDigitos(valor);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Número para o link tel: (+55 e só dígitos). */
export function discagem(valor: string): string {
  let d = soDigitos(valor);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  return `+55${d}`;
}

export const emailValido = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const vazio = (s: string) => !s.trim();

export function validarConta(c: {
  nome: string;
  email: string;
  senha: string;
  convite?: string;
  porConvite: boolean;
}): Erros {
  const e: Erros = {};
  if (c.porConvite && vazio(c.convite ?? ""))
    e.convite = "Cole o código do convite que você recebeu.";
  if (vazio(c.nome)) e.nome = "Informe seu nome.";
  else if (c.nome.length > MAX_NOME) e.nome = "Use até 100 caracteres.";
  if (vazio(c.email)) e.email = "Informe seu e-mail.";
  else if (!emailValido(c.email)) e.email = "Confira o e-mail, ex.: maria@email.com.";
  if (!c.senha) e.senha = "Crie uma senha.";
  else if (c.senha.length < 12)
    e.senha = `A senha tem ${c.senha.length} caracteres. Use pelo menos 12.`;
  return e;
}

export interface Morador {
  name: string;
  relation: string;
}

export function validarPessoa(p: {
  nome: string;
  telefone: string;
  moraSozinho: boolean | null;
  moradores: Morador[];
}): Erros {
  const e: Erros = {};
  if (vazio(p.nome)) e.nome = "Informe o nome de quem você vai acompanhar.";
  else if (p.nome.length > MAX_NOME) e.nome = "Use até 100 caracteres.";
  if (vazio(p.telefone)) e.telefone = "Informe o telefone.";
  else if (!telefoneValido(p.telefone))
    e.telefone = "Use DDD e número, ex.: (11) 98123-4567.";
  if (p.moraSozinho === null) e.moraSozinho = "Escolha uma opção.";
  else if (!p.moraSozinho && p.moradores.length === 0)
    e.moradorNome = "Adicione pelo menos uma pessoa que mora com ele.";
  if (p.moradores.length > MAX_MORADORES) e.moradorNome = "Até 10 moradores.";
  return e;
}

export function validarMorador(m: Morador, total: number): Erros {
  const e: Erros = {};
  if (total >= MAX_MORADORES) e.moradorNome = "Até 10 moradores.";
  else if (vazio(m.name)) e.moradorNome = "Informe o nome.";
  else if (m.name.length > MAX_NOME) e.moradorNome = "Use até 100 caracteres.";
  if (m.relation.length > 60) e.moradorRelacao = "Use até 60 caracteres.";
  return e;
}

export function validarConsentimento(c: {
  quem: "SELF" | "GUARDIAN" | null;
  responsavel: string;
  concorda: boolean;
}): Erros {
  const e: Erros = {};
  if (!c.quem) e.quem = "Escolha quem está aceitando.";
  if (c.quem === "GUARDIAN") {
    if (vazio(c.responsavel)) e.responsavel = "Informe o nome do responsável legal.";
    else if (c.responsavel.length > MAX_NOME) e.responsavel = "Use até 100 caracteres.";
  }
  if (!c.concorda) e.concorda = "Sem o aceite o monitoramento não começa.";
  return e;
}

export function validarContato(c: {
  nome: string;
  parentesco: string;
  telefone: string;
}): Erros {
  const e: Erros = {};
  if (vazio(c.nome)) e.contatoNome = "Informe o nome do contato.";
  else if (c.nome.length > MAX_NOME) e.contatoNome = "Use até 100 caracteres.";
  if (c.parentesco.length > 60) e.contatoParentesco = "Use até 60 caracteres.";
  if (vazio(c.telefone)) e.contatoTelefone = "Informe o telefone.";
  else if (!telefoneValido(c.telefone))
    e.contatoTelefone = "Use DDD e número, ex.: (11) 98765-4321.";
  return e;
}

export interface Endereco {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
}

/** CEP com máscara 00000-000. */
export function formatarCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Mesmo limite do backend: a casa precisa estar no estado de São Paulo. */
export const pontoEmSP = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -25.5 &&
  lat <= -19.5 &&
  lng >= -53.5 &&
  lng <= -44;

export function validarEndereco(
  a: Endereco,
  ponto: { lat: number; lng: number } | null,
  confirmado: boolean,
): Erros {
  const e: Erros = {};
  if (vazio(a.cep)) e.cep = "Informe o CEP.";
  else if (soDigitos(a.cep).length !== 8) e.cep = "O CEP tem 8 números, ex.: 01310-100.";
  if (vazio(a.street)) e.street = "Informe a rua.";
  else if (a.street.length > 100) e.street = "Use até 100 caracteres.";
  if (vazio(a.number)) e.number = "Informe o número (ou s/n).";
  else if (a.number.length > 15) e.number = "Use até 15 caracteres.";
  if (a.complement.length > 60) e.complement = "Use até 60 caracteres.";
  if (a.district.length > 60) e.district = "Use até 60 caracteres.";
  if (vazio(a.city)) e.city = "Informe a cidade.";
  else if (a.city.length > 60) e.city = "Use até 60 caracteres.";
  if (!ponto) e.mapa = "Busque o CEP ou toque no mapa para marcar a casa.";
  else if (!pontoEmSP(ponto.lat, ponto.lng))
    e.mapa = "Por enquanto o Amparo atende só o estado de São Paulo.";
  else if (!confirmado) e.confirmado = "Confira o pino e marque a confirmação.";
  return e;
}

/** Id do contato da família criado no passo 6 (o primeiro a ser avisado). */
export const ID_PRIMEIRO_CONTATO = "familia-1";

/** Cômodos que a câmera pode filmar quando a família ainda não escolheu. */
export const CAMERA_PADRAO = new Set(["sala", "cozinha"]);

/** O banheiro (e o lavabo) nunca é filmado. O servidor também força isso. */
export const ehBanheiro = (id: string) =>
  /^(banheiro|lavabo)(-\d+)?$/.test(id.trim().toLowerCase());

/** Mostra só o começo e o fim de uma chave longa ("amp_dev_3f9c…b71e"). */
export const encurtar = (valor: string, inicio = 12, fim = 4) =>
  valor.length <= inicio + fim + 1
    ? valor
    : `${valor.slice(0, inicio)}…${valor.slice(-fim)}`;
