// API do robô assistente e da planta da casa.
// Se o backend estiver offline (erro de rede), usa o robô simulado no navegador (modo demonstração).
import type { HouseLayout, MissionRequest, RobotMission, RobotState } from '../types/robot';
import { DemoRobot } from '../robot/demoRobot';
import { FALLBACK_LAYOUT } from '../robot/houseLayout';
import { ApiError, AuthRequiredError, apiJson } from './auth';

const ROBOT_ID = 'AMPARO-BOT-01';
let demoRobot: DemoRobot | null = null;
let demoTimer: number | null = null;
let usingDemo = false;

const isNetworkError = (error: unknown) =>
  error instanceof ApiError ? error.offline : !(error instanceof AuthRequiredError);

function demo(): DemoRobot {
  if (!demoRobot) {
    demoRobot = new DemoRobot(FALLBACK_LAYOUT, ROBOT_ID);
    let last = performance.now();
    demoTimer = window.setInterval(() => {
      const now = performance.now();
      demoRobot!.tick(Math.min(0.5, (now - last) / 1000));
      last = now;
    }, 100);
  }
  return demoRobot;
}

async function withDemo<T>(online: () => Promise<T>, offline: () => T): Promise<T> {
  try {
    const result = await online();
    usingDemo = false;
    return result;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    usingDemo = true;
    return offline();
  }
}

export const robotApi = {
  robotId: ROBOT_ID,
  isDemo: () => usingDemo,
  demo,

  getLayout: () => withDemo(() => apiJson<HouseLayout>('/house/layout'), () => FALLBACK_LAYOUT),

  getState: () => withDemo(() => apiJson<RobotState>(`/robot/${ROBOT_ID}/state`), () => demo().getState()),

  listMissions: (limit = 8) =>
    withDemo(() => apiJson<RobotMission[]>(`/robot/${ROBOT_ID}/missions?limit=${limit}`), () => demo().listMissions(limit)),

  requestMission: (request: MissionRequest) =>
    withDemo(
      () => apiJson<RobotMission>(`/robot/${ROBOT_ID}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      }),
      () => demo().request(request)
    ),

  cancelMission: (missionId: number) =>
    withDemo(
      () => apiJson<RobotMission>(`/robot/${ROBOT_ID}/missions/${missionId}/cancel`, { method: 'POST' }),
      () => demo().cancel(missionId) as RobotMission
    ),

  stopDemo() {
    if (demoTimer !== null) window.clearInterval(demoTimer);
    demoTimer = null;
    demoRobot = null;
  }
};
