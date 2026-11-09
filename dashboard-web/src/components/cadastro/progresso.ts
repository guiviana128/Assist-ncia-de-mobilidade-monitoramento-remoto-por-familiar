// Onde a pessoa está no cadastro. Vale para esta aba (sessionStorage): recarregar continua do
// mesmo passo. O passo também vai para o servidor (onboardingStep), para outra aba ou aparelho
// retomar de onde parou.
import { useSyncExternalStore } from "react";
import { CADASTRO_CONCLUIDO, passoPulado, TOTAL_PASSOS } from "./regras";

export interface Progresso {
  ativo: boolean;
  passo: number;
  /** Entrou por "Recebi um convite": pula os passos 2 a 6. */
  convite: boolean;
  /** Conta criada no passo 1 (o e-mail dela). */
  email: string | null;
  /** 1 = avançando, -1 = voltando (sentido da troca de passo). */
  direcao: 1 | -1;
  /** Aberto pelo painel só para registrar o consentimento: ao aceitar, volta ao painel. */
  soConsentimento: boolean;
}

/** Códigos que aparecem uma vez só, no registro. Ficam na aba até o passo 7 ser confirmado. */
export interface Acesso {
  recoveryCode: string;
  deviceKey: string;
  deviceId: string;
  robotId: string;
}

const CHAVE = "amparo_cadastro";
const CHAVE_ACESSO = "amparo_cadastro_acesso";
const INATIVO: Progresso = {
  ativo: false,
  passo: 1,
  convite: false,
  email: null,
  direcao: 1,
  soConsentimento: false,
};

const ler = <T,>(chave: string): T | null => {
  try {
    const bruto = sessionStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
};
const gravar = (chave: string, valor: unknown) => {
  try {
    if (valor === null) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: o progresso vale até recarregar */
  }
};

let estado: Progresso = { ...INATIVO, ...(ler<Progresso>(CHAVE) ?? {}) };
let acesso: Acesso | null = ler<Acesso>(CHAVE_ACESSO);
const ouvintes = new Set<() => void>();

function mudar(proximo: Progresso) {
  estado = proximo;
  gravar(CHAVE, estado.ativo ? estado : null);
  ouvintes.forEach((o) => o());
}

export const progresso = {
  get: () => estado,
  assinar(o: () => void) {
    ouvintes.add(o);
    return () => {
      ouvintes.delete(o);
    };
  },
  /** "Criar conta da família" ou "Recebi um convite" na tela de entrada. */
  iniciar(convite: boolean) {
    acesso = null;
    gravar(CHAVE_ACESSO, null);
    mudar({ ...INATIVO, ativo: true, convite });
  },
  /** Volta para a tela de entrada (antes de criar a conta). */
  cancelar() {
    mudar({ ...INATIVO });
  },
  /** Conta criada no passo 1. */
  registrar(email: string, codigos: Acesso) {
    acesso = codigos;
    gravar(CHAVE_ACESSO, codigos);
    mudar({
      ...estado,
      email,
      passo: estado.convite ? 7 : 2,
      direcao: 1,
    });
  },
  avancar() {
    let passo = estado.passo + 1;
    while (passoPulado(passo, estado.convite)) passo++;
    mudar({ ...estado, passo: Math.min(TOTAL_PASSOS, passo), direcao: 1 });
  },
  voltar() {
    let passo = estado.passo - 1;
    while (passoPulado(passo, estado.convite)) passo--;
    mudar({ ...estado, passo: Math.max(1, passo), direcao: -1 });
  },
  /** Retoma pelo passo salvo no servidor (outra aba, outro aparelho). */
  retomar(email: string, passo: number) {
    mudar({
      ...INATIVO,
      ativo: true,
      email,
      passo: Math.min(TOTAL_PASSOS, Math.max(2, passo)),
    });
  },
  /** O painel pede o consentimento que falta (contas antigas ou consentimento retirado). */
  pedirConsentimento(email: string) {
    mudar({ ...INATIVO, ativo: true, email, passo: 3, soConsentimento: true });
  },
  concluir() {
    acesso = null;
    gravar(CHAVE_ACESSO, null);
    mudar({ ...INATIVO });
  },
  acesso: () => acesso,
  guardarAcesso(codigos: Acesso) {
    acesso = codigos;
    gravar(CHAVE_ACESSO, codigos);
    ouvintes.forEach((o) => o());
  },
  /** Depois de "Guardei os códigos": eles saem do navegador. */
  esquecerAcesso() {
    acesso = null;
    gravar(CHAVE_ACESSO, null);
    ouvintes.forEach((o) => o());
  },
};

export const useProgresso = () =>
  useSyncExternalStore(progresso.assinar, progresso.get);

/** Passo salvo no servidor que ainda pede cadastro (contas antigas não têm onboardingStep). */
export const cadastroPendente = (onboardingStep?: number) =>
  typeof onboardingStep === "number" && onboardingStep < CADASTRO_CONCLUIDO;
