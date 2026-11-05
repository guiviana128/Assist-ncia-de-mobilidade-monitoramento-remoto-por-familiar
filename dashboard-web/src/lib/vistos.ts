// Avisos marcados como vistos nesta sessão (só tira o ponto azul; não resolve o alerta no servidor).
import { useSyncExternalStore } from 'react';

const CHAVE = 'amparo_avisos_vistos';
let vistos: Set<number> = (() => {
  try { return new Set(JSON.parse(sessionStorage.getItem(CHAVE) ?? '[]') as number[]); } catch { return new Set<number>(); }
})();
const ouvintes = new Set<() => void>();

export const avisosVistos = {
  get: () => vistos,
  assinar(o: () => void) { ouvintes.add(o); return () => { ouvintes.delete(o); }; },
  marcar(ids: number[]) {
    vistos = new Set([...vistos, ...ids]);
    try { sessionStorage.setItem(CHAVE, JSON.stringify([...vistos])); } catch { /* armazenamento indisponível */ }
    ouvintes.forEach(o => o());
  }
};

export const useAvisosVistos = () => useSyncExternalStore(avisosVistos.assinar, avisosVistos.get);
