import React from 'react';

export type EstadoConexao = 'conectado' | 'demonstracao' | 'sem-conexao';

const TEXTO: Record<EstadoConexao, { longo: string; curto: string; tom: string }> = {
  conectado: { longo: 'Bengala conectada', curto: 'Conectada', tom: 'is-sucesso' },
  demonstracao: { longo: 'Modo demonstração', curto: 'Demonstração', tom: 'is-aviso' },
  'sem-conexao': { longo: 'Sem conexão com a bengala', curto: 'Sem conexão', tom: 'is-perigo' }
};

/** Um único indicador de conexão para o sistema inteiro (Figma: StatusConexao). */
export const StatusConexao: React.FC<{ estado: EstadoConexao; curto?: boolean }> = ({ estado, curto }) => {
  const t = TEXTO[estado];
  return (
    <span className={`selo ${t.tom}${curto ? ' is-pequeno' : ''}`} role="status" title={t.longo}>
      {curto ? t.curto : t.longo}
    </span>
  );
};
