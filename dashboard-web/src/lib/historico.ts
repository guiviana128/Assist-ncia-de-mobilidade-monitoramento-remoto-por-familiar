// Histórico do Monitorar.
// O backend ainda não guarda passos por dia nem leituras de tremor: os dias anteriores e a curva
// de tremor são EXEMPLOS determinísticos (sempre os mesmos para a mesma data). O dia de hoje usa
// o valor real da bengala (stepsToday) quando ele existe. A tela mostra um aviso discreto disso.

export type Periodo = 'hoje' | '7' | '30';
export const META_PASSOS = 1500;

export interface Barra { rotulo: string; rotuloCurto: string; numero?: string; valor: number; hoje: boolean; data: Date }

/** Gerador simples e estável a partir de um número (dia do ano). */
const ruido = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const diaDoAno = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
const passosExemplo = (d: Date) => Math.round((1050 + ruido(diaDoAno(d) + d.getFullYear()) * 800) / 10) * 10;

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function passosPorDia(dias: number, passosHoje: number | undefined, agora = new Date()): Barra[] {
  const barras: Barra[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(agora);
    d.setDate(agora.getDate() - i);
    const hoje = i === 0;
    barras.push({
      data: d, hoje,
      rotulo: hoje ? 'Hoje' : DIAS[d.getDay()]!,
      numero: hoje ? 'Hoje' : String(d.getDate()),
      rotuloCurto: hoje ? 'Hoje' : DIAS[d.getDay()]!.charAt(0),
      valor: hoje && passosHoje != null ? passosHoje : passosExemplo(d)
    });
  }
  return barras;
}

/** Passos por faixa de 2 h ao longo de hoje (exemplo proporcional ao total real). */
export function passosHoje(total: number, agora = new Date()): Barra[] {
  const pesos = [0.04, 0.16, 0.14, 0.1, 0.12, 0.18, 0.16, 0.1];
  const horaAtual = agora.getHours();
  const faixas = pesos.map((p, i) => ({ inicio: 6 + i * 2, p }));
  const passadas = faixas.filter(f => f.inicio <= horaAtual);
  const soma = passadas.reduce((s, f) => s + f.p, 0) || 1;
  return faixas.map(f => ({
    data: agora, hoje: f.inicio <= horaAtual && horaAtual < f.inicio + 2,
    rotulo: `${f.inicio}h`, rotuloCurto: `${f.inicio}`,
    valor: f.inicio <= horaAtual ? Math.round((total * f.p) / soma / 10) * 10 : 0
  }));
}

export const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/** Comprimento do passo ~0,55 m para estimar a distância. */
export const km = (passos: number) => (passos * 0.55) / 1000;

/** Curva de tremor (Hz) para o período: exemplo estável perto de 1,2 Hz. */
export function tremor(pontos: number, agora = new Date()): number[] {
  const base = diaDoAno(agora);
  return Array.from({ length: pontos }, (_, i) => 1.05 + ruido(base * 31 + i) * 0.35);
}

export const formatarNumero = (n: number) => Math.round(n).toLocaleString('pt-BR');
export const formatarKm = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
