// Preferências de cuidado desta sessão: remédios e contatos de emergência.
// Não há cadastro persistente no backend para estes dados; são exemplos editáveis que
// valem até fechar a aba. Início (próximo remédio, Ligar para José) e Configurações leem daqui.
import { useSyncExternalStore } from "react";
import { auth, apiJson } from "../services/auth";

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
}

interface Estado {
  remedios: Remedio[];
  contatos: Contato[];
  /** Telefone de quem é acompanhado (botão "Ligar para José"). */
  telefonePessoa: string;
  /** Endereço para o socorro (exemplo editável). */
  endereco: string;
  /** A primeira área é a casa: centro do perímetro do mapa. */
  areas: AreaSegura[];
  bengala: PreferenciasBengala;
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
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());
async function carregar() {
  const g = auth.generation;
  estado = vazio();
  erro = "";
  avisar();
  if (!auth.isLoggedIn()) return;
  carregando = true;
  try {
    const data = await apiJson<Partial<Estado>>("/care/preferences");
    if (g === auth.generation) estado = { ...vazio(), ...data };
  } catch {
    if (g === auth.generation)
      erro = "Não foi possível carregar as preferências.";
  } finally {
    if (g === auth.generation) {
      carregando = false;
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
    if (g !== auth.generation || carregando) return false;
    const next = mudar(estado);
    try {
      if (auth.isLoggedIn())
        await apiJson("/care/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
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
      areas: s.areas.map((a, i) => (i === 0 ? { ...a, raio } : a)),
    })),
  definirBengala: (p: Partial<PreferenciasBengala>) =>
    salvar((s) => ({ ...s, bengala: { ...s.bengala, ...p } })),
  definirContato: (telefonePessoa: string, endereco: string) =>
    salvar((s) => ({ ...s, telefonePessoa, endereco })),
};
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
