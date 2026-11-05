import { useCallback, useEffect, useRef, useState } from 'react';
import type { HouseLayout, RobotMission, RobotState } from '../types/robot';
import { FALLBACK_LAYOUT } from '../robot/houseLayout';
import { robotApi } from '../services/robotApi';

/**
 * Estado do robô e da planta para as telas fora da Casa 3D (Início, frase de estado).
 * A Casa 3D mantém a própria consulta de 1 s; aqui o ritmo é o do painel (3,5 s).
 * Também mede há quanto tempo o José está no cômodo atual.
 */
export function useRobo(intervaloMs = 3500) {
  const [layout, setLayout] = useState<HouseLayout>(FALLBACK_LAYOUT);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [missions, setMissions] = useState<RobotMission[]>([]);
  const [noComodoDesde, setNoComodoDesde] = useState<number | null>(null);
  const ultimoComodo = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    robotApi.getLayout().then(l => { if (ativo) setLayout(l); }).catch(() => undefined);
    return () => { ativo = false; };
  }, []);

  const atualizar = useCallback(async () => {
    try {
      const [state, lista] = await Promise.all([robotApi.getState(), robotApi.listMissions(12)]);
      setRobot(state);
      setMissions(lista);
      const comodo = state.personRoom ?? null;
      if (ultimoComodo.current === undefined) {
        // primeira leitura: não sabemos desde quando ele está ali
        ultimoComodo.current = comodo;
      } else if (comodo !== ultimoComodo.current) {
        ultimoComodo.current = comodo;
        setNoComodoDesde(Date.now());
      }
    } catch { /* login é tratado no App; demais falhas: tenta no próximo ciclo */ }
  }, []);

  useEffect(() => {
    void atualizar();
    const timer = window.setInterval(() => void atualizar(), intervaloMs);
    return () => window.clearInterval(timer);
  }, [atualizar, intervaloMs]);

  return { layout, robot, missions, noComodoDesde, atualizar, demo: robotApi.isDemo() };
}
