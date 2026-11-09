import { useCallback, useEffect, useRef, useState } from "react";
import type { HouseLayout, RobotMission, RobotState } from "../types/robot";
import { FALLBACK_LAYOUT } from "../robot/houseLayout";
import { auth } from "../services/auth";
import { robotApi } from "../services/robotApi";
import { presentation } from "../services/presentation";

export type ObservacaoComodo = { comodo: string; quando: number };

function historicoComodos(chave: string): ObservacaoComodo[] {
  try {
    const dados: unknown = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(dados)
      ? dados.filter((item) => typeof item?.comodo === "string" &&
          typeof item.quando === "number" && Number.isFinite(item.quando)).slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

/**
 * Estado do robô e da planta para as telas fora da Casa 3D (Início, frase de estado).
 * A Casa 3D mantém a própria consulta de 1 s; aqui o ritmo é o do painel (3,5 s).
 * Também mede há quanto tempo o José está no cômodo atual.
 */
/**
 * @param ativo só consulta com o painel aberto
 * @param chavePlanta muda quando a família troca a planta: a planta é buscada de novo
 */
export function useRobo(ativo = true, chavePlanta = "", intervaloMs = 3500) {
  const [layout, setLayout] = useState<HouseLayout>(FALLBACK_LAYOUT);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [missions, setMissions] = useState<RobotMission[]>([]);
  const [noComodoDesde, setNoComodoDesde] = useState<number | null>(null);
  const [observacoes, setObservacoes] = useState<ObservacaoComodo[]>([]);
  const observacoesRef = useRef<ObservacaoComodo[]>([]);
  const ultimoComodo = useRef<string | null | undefined>(undefined);

  // Real ⇄ demonstração também troca a planta (a demonstração usa a casa de exemplo).
  const [fonte, setFonte] = useState(0);
  useEffect(() => presentation.subscribe(() => setFonte((n) => n + 1)), []);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    robotApi
      .getLayout()
      .then((l) => {
        if (vivo) setLayout(l);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [ativo, chavePlanta, fonte]);

  useEffect(
    () =>
      auth.onChange(() => {
        setRobot(null);
        setMissions([]);
        observacoesRef.current = [];
        setObservacoes([]);
        setNoComodoDesde(null);
        ultimoComodo.current = undefined;
      }),
    [],
  );
  const atualizar = useCallback(async () => {
    const generation = auth.generation;
    const sourceGeneration = presentation.generation;
    try {
      const [state, lista] = await Promise.all([
        robotApi.getState(),
        robotApi.listMissions(12),
      ]);
      if (
        generation !== auth.generation ||
        sourceGeneration !== presentation.generation
      )
        return;
      setRobot(state);
      setMissions(lista);
      const comodo = state.online && state.mode !== "OFFLINE" ? state.personRoom ?? null : null;
      if (comodo && comodo !== ultimoComodo.current) {
        const agora = Date.now();
        const usuario = auth.username;
        const chave = usuario
          ? `amparo_atividades_${encodeURIComponent(usuario)}_${presentation.get()}`
          : null;
        const anteriores = observacoesRef.current.length || !chave
          ? observacoesRef.current : historicoComodos(chave);
        const ultima = anteriores[0];
        const mesmoDia = ultima && new Date(ultima.quando).toDateString() === new Date(agora).toDateString();
        const lista = mesmoDia && ultima.comodo === comodo
          ? anteriores
          : [{ comodo, quando: agora }, ...anteriores].slice(0, 100);
        observacoesRef.current = lista;
        setObservacoes(lista);
        if (chave) {
          try {
            localStorage.setItem(chave, JSON.stringify(lista));
          } catch {
            // O histórico continua disponível nesta sessão.
          }
        }
      }
      if (ultimoComodo.current === undefined) {
        // primeira leitura: não sabemos desde quando ele está ali
        ultimoComodo.current = comodo;
      } else if (comodo !== ultimoComodo.current) {
        ultimoComodo.current = comodo;
        setNoComodoDesde(Date.now());
      }
    } catch {
      /* login é tratado no App; demais falhas: tenta no próximo ciclo */
    }
  }, []);
  useEffect(
    () =>
      presentation.subscribe(() => {
        setRobot(null);
        setMissions([]);
        observacoesRef.current = [];
        setObservacoes([]);
        setNoComodoDesde(null);
        ultimoComodo.current = undefined;
        if (ativo) void atualizar();
      }),
    [atualizar, ativo],
  );

  // Só consulta com o painel aberto (sessão válida e cadastro concluído); para ao sair.
  useEffect(() => {
    if (!ativo) return;
    void atualizar();
    const timer = window.setInterval(() => void atualizar(), intervaloMs);
    return () => window.clearInterval(timer);
  }, [atualizar, intervaloMs, ativo]);

  return {
    layout,
    robot,
    missions,
    observacoes,
    noComodoDesde,
    atualizar,
    demo: robotApi.isDemo(),
  };
}
