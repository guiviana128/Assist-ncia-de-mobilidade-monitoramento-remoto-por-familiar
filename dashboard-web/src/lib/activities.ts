export const atividades = {
  remedio: 'tomou o remédio', cozinha: 'cozinhou', caminhada: 'caminhou', descanso: 'descansou',
  agua: 'bebeu água', cafe: 'tomou café da manhã', almoco: 'almoçou', jantar: 'jantou',
  leitura: 'leu um livro', televisao: 'assistiu à televisão', conversa: 'conversou com a família',
  dentes: 'escovou os dentes', banho: 'tomou banho', alongamento: 'fez alongamento',
  computador: 'usou o computador', vestir: 'trocou de roupa',
} as const;
export type Atividade = keyof typeof atividades;
const minutos: Partial<Record<Atividade, number>> = {
  cozinha: 20, descanso: 20, cafe: 15, almoco: 20, jantar: 20,
  leitura: 15, televisao: 20, conversa: 10, banho: 15, computador: 15, caminhada: 10,
};
export const intervaloAtividade = (atividade: Atividade) => (minutos[atividade] ?? 5) * 60_000;
const opcoes: Record<string, Atividade[]> = {
  sala: ['televisao', 'conversa', 'alongamento', 'leitura'],
  cozinha: ['agua', 'cozinha', 'cafe', 'almoco', 'jantar'],
  quarto: ['descanso', 'vestir', 'leitura'],
  escritorio: ['computador', 'leitura', 'conversa'],
  jantar: ['almoco', 'jantar', 'conversa', 'leitura'],
  servico: ['caminhada', 'vestir'],
  banheiro: ['dentes', 'banho'], lavabo: ['dentes'],
};

/** Apenas roteiro fictício, nunca inferir medicação ou higiene de presença real. */
export function atividadesSimuladas(observacoes: { comodo: string; quando: number }[]) {
  const registros: { comodo: string; quando: number; atividade: Atividade }[] = [];
  const contagem: Record<string, number> = {};
  for (const observacao of [...observacoes].sort((a, b) => a.quando - b.quando)) {
    const anterior = registros[registros.length - 1];
    if (anterior?.comodo === observacao.comodo) continue;
    if (anterior && observacao.quando - anterior.quando < intervaloAtividade(anterior.atividade)) continue;
    const tipo = observacao.comodo.replace(/-\d+$/, '');
    const lista = opcoes[tipo] ?? ['caminhada'];
    const indice = contagem[tipo] ?? 0;
    const atividade = lista[indice % lista.length]!;
    contagem[tipo] = indice + 1;
    registros.push({ ...observacao, atividade });
  }
  return registros.reverse();
}
