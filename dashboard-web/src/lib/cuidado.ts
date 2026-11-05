// Preferências de cuidado desta sessão: remédios e contatos de emergência.
// Não há cadastro persistente no backend para estes dados; são exemplos editáveis que
// valem até fechar a aba. Início (próximo remédio, Ligar para José) e Configurações leem daqui.
import { useSyncExternalStore } from 'react';

export interface Remedio { id: number; nome: string; hora: string; detalhe?: string }
export interface AreaSegura { id: string; nome: string; detalhe: string; lat: number; lng: number; raio: number; ativa: boolean }
export interface PreferenciasBengala { distanciaAvisoCm: number; vibracao: boolean; apito: boolean; farol: boolean; detectarQuedas: boolean }
export interface Contato { id: string; nome: string; papel: string; telefone: string; discagem: string }

interface Estado {
  remedios: Remedio[];
  contatos: Contato[];
  /** Telefone de quem é acompanhado (botão "Ligar para José"). */
  telefonePessoa: string;
  /** A primeira área é a casa: centro do perímetro do mapa. */
  areas: AreaSegura[];
  bengala: PreferenciasBengala;
}

let estado: Estado = {
  remedios: [
    { id: 1, nome: 'Remédio da pressão', hora: '08:00', detalhe: 'Losartana 50 mg' },
    { id: 2, nome: 'Vitaminas', hora: '12:30', detalhe: 'Complexo vitamínico' },
    { id: 3, nome: 'Remédio da diabetes', hora: '19:00', detalhe: 'Metformina 500 mg' }
  ],
  contatos: [
    { id: 'maria', nome: 'Maria Silva', papel: 'Filha · recebe todos os avisos', telefone: '(11) 98765-4321', discagem: '+5511987654321' },
    { id: 'samu', nome: 'SAMU', papel: 'Emergência médica', telefone: '192', discagem: '192' },
    { id: 'bombeiros', nome: 'Bombeiros', papel: 'Resgate e incêndio', telefone: '193', discagem: '193' }
  ],
  telefonePessoa: '+5511912345678',
  areas: [
    { id: 'casa', nome: 'Casa', detalhe: 'Perímetro principal', lat: -23.550520, lng: -46.633308, raio: 500, ativa: true },
    { id: 'praca', nome: 'Praça do bairro', detalhe: 'Caminhada da tarde', lat: -23.552200, lng: -46.635100, raio: 150, ativa: true },
    { id: 'farmacia', nome: 'Farmácia', detalhe: 'A 600 m de casa', lat: -23.548900, lng: -46.631000, raio: 100, ativa: true },
    { id: 'posto', nome: 'Posto de saúde', detalhe: 'Consultas de rotina', lat: -23.553500, lng: -46.637000, raio: 200, ativa: false }
  ],
  bengala: { distanciaAvisoCm: 100, vibracao: true, apito: true, farol: true, detectarQuedas: true }
};

const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach(o => o());

export const cuidado = {
  get: () => estado,
  assinar(o: () => void) { ouvintes.add(o); return () => { ouvintes.delete(o); }; },
  adicionarRemedio(r: Omit<Remedio, 'id'>) {
    estado = { ...estado, remedios: [...estado.remedios, { ...r, id: Date.now() }].sort((a, b) => a.hora.localeCompare(b.hora)) };
    avisar();
  },
  alternarArea(id: string) {
    estado = { ...estado, areas: estado.areas.map(a => a.id === id ? { ...a, ativa: !a.ativa } : a) };
    avisar();
  },
  definirRaioCasa(raio: number) {
    estado = { ...estado, areas: estado.areas.map((a, i) => i === 0 ? { ...a, raio } : a) };
    avisar();
  },
  definirBengala(parcial: Partial<PreferenciasBengala>) {
    estado = { ...estado, bengala: { ...estado.bengala, ...parcial } };
    avisar();
  },
  removerRemedio(id: number) {
    estado = { ...estado, remedios: estado.remedios.filter(r => r.id !== id) };
    avisar();
  }
};

export const useCuidado = () => useSyncExternalStore(cuidado.assinar, cuidado.get);

/** Próximo remédio de hoje a partir de agora (ou o primeiro de amanhã). */
export function proximoRemedio(remedios: Remedio[], agora = new Date()): { remedio: Remedio; amanha: boolean } | null {
  if (!remedios.length) return null;
  const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  const ordenados = [...remedios].sort((a, b) => a.hora.localeCompare(b.hora));
  const hoje = ordenados.find(r => r.hora > hhmm);
  return hoje ? { remedio: hoje, amanha: false } : { remedio: ordenados[0]!, amanha: true };
}
