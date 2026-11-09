// Preferências de cuidado da família (GET/PUT /care/preferences): remédios, contatos, casa e o
// que o cadastro em 8 passos registra. Início (próximo remédio, Ligar para José), Configurações e
// o cadastro leem daqui. Os dados de exemplo (Maria Silva…) só aparecem no modo demonstração.
import { useSyncExternalStore } from "react";
import { auth, apiJson } from "../services/auth";
import type { HomeConfiguration } from "./monitoring";
import type { HouseLayout } from "../types/robot";
import { FALLBACK_LAYOUT, layoutDoModelo } from "../robot/houseLayout";
import { discagem } from "../components/cadastro/regras";

export interface Remedio {
  id: number;
  nome: string;
  hora: string;
  detalhe?: string;
  ativo: boolean;
}
export interface AreaSegura {
  id: string;
  nome: string;
  detalhe: string;
  lat: number;
  lng: number;
  raio: number;
  ativa: boolean;
}
export interface PreferenciasBengala {
  distanciaAvisoCm: number;
  forcaVibracao: "fraca" | "media" | "forte";
  vibracao: boolean;
  apito: boolean;
  farol: boolean;
  detectarQuedas: boolean;
}
export interface Contato {
  id: string;
  nome: string;
  papel: string;
  telefone: string;
  discagem: string;
  /** Contato da família: recebe os avisos no celular. */
  avisos?: boolean;
}

/** Contatos fixos de emergência; os outros são da família. */
export const CONTATOS_PUBLICOS = new Set(["samu", "bombeiros"]);
export const contatosDaFamilia = (contatos: Contato[]) =>
  contatos.filter((c) => !CONTATOS_PUBLICOS.has(c.id));

export const SAMU: Contato = {
  id: "samu",
  nome: "SAMU",
  papel: "Emergência médica",
  telefone: "192",
  discagem: "192",
};
export const BOMBEIROS: Contato = {
  id: "bombeiros",
  nome: "Bombeiros",
  papel: "Resgate e incêndio",
  telefone: "193",
  discagem: "193",
};

export interface Consentimento {
  acceptedBy: "SELF" | "GUARDIAN";
  guardianName?: string;
  /** Gravado pelo servidor. */
  acceptedAt?: string;
  termsVersion: string;
  recordedBy?: string;
}
export type OrigemPlanta = "ROBOT" | "TEMPLATE" | "EXAMPLE";
export interface ModeloPlanta {
  kind: "HOUSE" | "APARTMENT";
  bedrooms: number;
  bathrooms: number;
}
export interface CameraComodo {
  room: string;
  allowed: boolean;
}

export interface Estado {
  home?: HomeConfiguration;
  remedios: Remedio[];
  contatos: Contato[];
  /** Telefone de quem é acompanhado (botão "Ligar para José"). */
  telefonePessoa: string;
  /** Endereço para o socorro (exemplo editável). */
  endereco: string;
  /** A primeira área é a casa: centro do perímetro do mapa. */
  areas: AreaSegura[];
  bengala: PreferenciasBengala;
  /* Cadastro em 8 passos (todos opcionais: contas antigas não têm) */
  personName?: string;
  personPhone?: string;
  livesAlone?: boolean;
  residents?: { name: string; relation: string }[];
  consent?: Consentimento | null;
  floorPlanSource?: OrigemPlanta;
  floorPlanTemplate?: ModeloPlanta;
  /** Planta gerada a partir do modelo (passo 5). O backend devolve esta em /house/layout. */
  floorPlanLayout?: HouseLayout;
  cameraRooms?: CameraComodo[];
  /** 1 a 8: passo do cadastro em andamento; 9: concluído. */
  onboardingStep?: number;
}

const exemplo: Estado = {
  remedios: [
    {
      id: 1,
      nome: "Remédio da pressão",
      hora: "08:00",
      detalhe: "Losartana 50 mg · todo dia",
      ativo: true,
    },
    {
      id: 2,
      nome: "Vitaminas",
      hora: "12:30",
      detalhe: "Complexo vitamínico · depois do almoço",
      ativo: true,
    },
    {
      id: 3,
      nome: "Remédio da diabetes",
      hora: "19:00",
      detalhe: "Metformina 500 mg · no jantar",
      ativo: true,
    },
  ],
  contatos: [
    {
      id: "maria",
      nome: "Maria Silva",
      papel: "Filha · recebe todos os avisos",
      telefone: "(11) 98765-4321",
      discagem: "+5511987654321",
    },
    {
      id: "samu",
      nome: "SAMU",
      papel: "Emergência médica",
      telefone: "192",
      discagem: "192",
    },
    {
      id: "bombeiros",
      nome: "Bombeiros",
      papel: "Resgate e incêndio",
      telefone: "193",
      discagem: "193",
    },
  ],
  telefonePessoa: "+5511912345678",
  endereco: "Rua das Palmeiras, 120 · casa térrea",
  areas: [
    {
      id: "casa",
      nome: "Casa",
      detalhe: "Perímetro principal",
      lat: -23.55052,
      lng: -46.633308,
      raio: 500,
      ativa: true,
    },
    {
      id: "praca",
      nome: "Praça do bairro",
      detalhe: "Caminhada da tarde",
      lat: -23.5522,
      lng: -46.6351,
      raio: 150,
      ativa: true,
    },
    {
      id: "farmacia",
      nome: "Farmácia",
      detalhe: "A 600 m de casa",
      lat: -23.5489,
      lng: -46.631,
      raio: 100,
      ativa: true,
    },
    {
      id: "posto",
      nome: "Posto de saúde",
      detalhe: "Consultas de rotina",
      lat: -23.5535,
      lng: -46.637,
      raio: 200,
      ativa: false,
    },
  ],
  bengala: {
    distanciaAvisoCm: 100,
    forcaVibracao: "media",
    vibracao: true,
    apito: true,
    farol: true,
    detectarQuedas: true,
  },
};

const vazio = (): Estado => ({
  remedios: [],
  contatos: [],
  telefonePessoa: "",
  endereco: "Não cadastrado",
  areas: [
    {
      id: "casa",
      nome: "Casa não configurada",
      detalhe: "Cadastre a localização real antes de usar a cerca",
      lat: 0,
      lng: 0,
      raio: 500,
      ativa: false,
    },
  ],
  bengala: {
    distanciaAvisoCm: 100,
    forcaVibracao: "media",
    vibracao: true,
    apito: true,
    farol: true,
    detectarQuedas: true,
  },
});
let estado: Estado = vazio();
let erro = "";
let carregando = false;
let pronto = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());
async function carregar() {
  const g = auth.generation;
  estado = vazio();
  erro = "";
  pronto = false;
  avisar();
  if (!auth.isLoggedIn()) return;
  carregando = true;
  try {
    const data = await apiJson<Partial<Estado>>("/care/preferences");
    if (g === auth.generation) {
      estado = { ...vazio(), ...data };
      pronto = true;
    }
  } catch {
    if (g === auth.generation)
      erro = "Não foi possível carregar as preferências.";
  } finally {
    if (g === auth.generation) {
      carregando = false;
      estado = { ...estado };
      avisar();
    }
  }
}
auth.onChange(() => void carregar());
if (auth.isLoggedIn()) void carregar();
let fila: Promise<unknown> = Promise.resolve();
function salvar(mudar: (s: Estado) => Estado): Promise<boolean> {
  const g = auth.generation;
  const operacao = async () => {
    if (g !== auth.generation || carregando || (auth.isLoggedIn() && !pronto))
      return false;
    let next = mudar(estado);
    try {
      if (auth.isLoggedIn()) {
        // O servidor devolve a versão normalizada (ex.: data do consentimento, banheiro bloqueado).
        const salvo = await apiJson<Partial<Estado> | undefined>(
          "/care/preferences",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          },
        );
        if (salvo && typeof salvo === "object") next = { ...vazio(), ...salvo };
      }
      if (g !== auth.generation) return false;
      estado = next;
      erro = "";
      avisar();
      return true;
    } catch {
      if (g === auth.generation) {
        erro = "Não foi possível salvar. A alteração não foi aplicada.";
        avisar();
      }
      return false;
    }
  };
  const result = fila.then(operacao, operacao);
  fila = result;
  return result;
}
export const cuidado = {
  pronto: () => pronto,
  recarregar: () => carregar(),
  carregando: () => carregando,
  get: () => estado,
  assinar(o: () => void) {
    ouvintes.add(o);
    return () => {
      ouvintes.delete(o);
    };
  },
  erro: () => erro,
  demonstracao() {
    if (!auth.isLoggedIn()) {
      estado = structuredClone(exemplo);
      avisar();
    }
  },
  alternarRemedio: (id: number) =>
    salvar((s) => ({
      ...s,
      remedios: s.remedios.map((r) =>
        r.id === id ? { ...r, ativo: !r.ativo } : r,
      ),
    })),
  adicionarRemedio: (r: Omit<Remedio, "id" | "ativo">) =>
    salvar((s) => ({
      ...s,
      remedios: [...s.remedios, { ...r, id: Date.now(), ativo: true }].sort(
        (a, b) => a.hora.localeCompare(b.hora),
      ),
    })),
  removerRemedio: (id: number) =>
    salvar((s) => ({ ...s, remedios: s.remedios.filter((r) => r.id !== id) })),
  alternarArea: (id: string) =>
    salvar((s) => ({
      ...s,
      areas: s.areas.map((a) => (a.id === id ? { ...a, ativa: !a.ativa } : a)),
    })),
  definirRaioCasa: (raio: number) =>
    salvar((s) => ({
      ...s,
      ...(s.home ? { home: { ...s.home, radius: raio } } : {}),
      areas: s.areas.map((a, i) => (i === 0 ? { ...a, raio } : a)),
    })),
  definirBengala: (p: Partial<PreferenciasBengala>) =>
    salvar((s) => ({ ...s, bengala: { ...s.bengala, ...p } })),
  /**
   * Telefone de quem é acompanhado e endereço do socorro (Configurações). O telefone vai para
   * personPhone (o servidor deriva telefonePessoa dele) e já sai em formato de discagem.
   */
  definirContato: (telefone: string, endereco: string) =>
    salvar((s) => ({
      ...s,
      personPhone: telefone.trim(),
      telefonePessoa: discagem(telefone),
      endereco,
      ...(s.home && endereco !== s.endereco
        ? {
            home: undefined,
            areas: s.areas.map((a) =>
              a.id === "casa" ? { ...a, ativa: false } : a,
            ),
          }
        : {}),
    })),
  /** Grava o que um passo do cadastro mudou (e o passo seguinte, em onboardingStep). */
  salvarCadastro: (patch: Partial<Estado> | ((s: Estado) => Partial<Estado>)) =>
    salvar((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })),
  definirCasa: (home: HomeConfiguration) => salvar((s) => comCasa(s, home)),
};
/** A casa confirmada vira o endereço do socorro e o centro da primeira área segura. */
export function comCasa(s: Estado, home: HomeConfiguration): Estado {
  return {
    ...s,
    home,
    endereco: `${home.address.street}, ${home.address.number}${home.address.complement ? " · " + home.address.complement : ""} · ${home.address.city} / SP`,
    areas: [
      {
        id: "casa",
        nome: "Casa",
        detalhe: "Localização confirmada pela família",
        lat: home.lat,
        lng: home.lng,
        raio: home.radius,
        ativa: true,
      },
      ...s.areas.filter((a) => a.id !== "casa"),
    ],
  };
}
/**
 * Planta que a família escolheu no passo 5: a gerada pelo modelo ou, sem modelo, a de exemplo.
 * (Mapear com o robô usa a de exemplo até o robô mapear a casa.)
 */
export function plantaDaFamilia(s: Pick<Estado, "floorPlanSource" | "floorPlanTemplate" | "floorPlanLayout">): HouseLayout {
  if (s.floorPlanSource !== "TEMPLATE") return FALLBACK_LAYOUT;
  return s.floorPlanLayout ?? (s.floorPlanTemplate ? layoutDoModelo(s.floorPlanTemplate) : FALLBACK_LAYOUT);
}
export const useCuidado = () =>
  useSyncExternalStore(cuidado.assinar, cuidado.get);
/** Próximo remédio de hoje a partir de agora (ou o primeiro de amanhã). */
export function proximoRemedio(
  remedios: Remedio[],
  agora = new Date(),
): { remedio: Remedio; amanha: boolean } | null {
  if (!remedios.some((r) => r.ativo)) return null;
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const ordenados = remedios
    .filter((r) => r.ativo)
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const hoje = ordenados.find((r) => r.hora > hhmm);
  return hoje
    ? { remedio: hoje, amanha: false }
    : { remedio: ordenados[0]!, amanha: true };
}
