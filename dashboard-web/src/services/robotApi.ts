// API do robô assistente e da planta da casa.
// Se o backend estiver offline (erro de rede), usa o robô simulado no navegador (modo demonstração).
import type {
  HouseLayout,
  MissionRequest,
  RobotMission,
  RobotState,
} from "../types/robot";
import { DemoRobot } from "../robot/demoRobot";
import { FALLBACK_LAYOUT } from "../robot/houseLayout";
import { ApiError, AuthRequiredError, apiJson, auth } from "./auth";
import { presentation } from "./presentation";

const ROBOT_ID = "AMPARO-BOT-01";
let realRobotId: string | null = null;
let robotGeneration = -1;
async function familyRobot() {
  if (robotGeneration !== auth.generation) {
    realRobotId = null;
    robotGeneration = auth.generation;
  }
  if (!realRobotId) {
    const generation = auth.generation;
    const devices = await apiJson<{ robotId: string }[]>("/care/devices");
    if (generation !== auth.generation) throw new AuthRequiredError();
    if (!devices[0]) throw new ApiError(404, "Nenhum robô vinculado");
    realRobotId = devices[0].robotId;
  }
  return realRobotId;
}
auth.onChange(() => {
  realRobotId = null;
  robotApi.stopDemo();
});
let demoRobot: DemoRobot | null = null;
let demoTimer: number | null = null;
let usingDemo = false;

const isNetworkError = (error: unknown) =>
  !auth.isLoggedIn() &&
  (error instanceof ApiError
    ? error.offline
    : !(error instanceof AuthRequiredError));

function demo(): DemoRobot {
  if (!demoRobot) {
    demoRobot = new DemoRobot(FALLBACK_LAYOUT, ROBOT_ID);
    let last = performance.now();
    let elapsed = 0;
    let roomIndex = 0;
    demoTimer = window.setInterval(() => {
      const now = performance.now();
      demoRobot!.tick(Math.min(0.5, (now - last) / 1000));
      elapsed += (now - last) / 1000;
      if (elapsed >= 8) {
        elapsed = 0;
        const rooms = ["sala", "cozinha", "escritorio", "quarto"];
        demoRobot!.setPersonRoom(rooms[++roomIndex % rooms.length]);
      }
      last = now;
    }, 100);
  }
  return demoRobot;
}

async function withDemo<T>(
  online: () => Promise<T>,
  offline: () => T,
): Promise<T> {
  if (auth.isLoggedIn() && presentation.get() === "demo") {
    usingDemo = true;
    return offline();
  }
  usingDemo = false;
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

  getLayout: () =>
    withDemo(
      () => apiJson<HouseLayout>("/house/layout"),
      () => FALLBACK_LAYOUT,
    ),

  getState: () =>
    withDemo(
      async () => apiJson<RobotState>(`/robot/${await familyRobot()}/state`),
      () => demo().getState(),
    ),

  listMissions: (limit = 8) =>
    withDemo(
      async () =>
        apiJson<RobotMission[]>(
          `/robot/${await familyRobot()}/missions?limit=${limit}`,
        ),
      () => demo().listMissions(limit),
    ),

  requestMission: (request: MissionRequest) =>
    withDemo(
      async () =>
        apiJson<RobotMission>(`/robot/${await familyRobot()}/missions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        }),
      () => demo().request(request),
    ),

  cancelMission: (missionId: number) =>
    withDemo(
      async () =>
        apiJson<RobotMission>(
          `/robot/${await familyRobot()}/missions/${missionId}/cancel`,
          { method: "POST" },
        ),
      () => demo().cancel(missionId) as RobotMission,
    ),

  stopDemo() {
    usingDemo = false;
    if (demoTimer !== null) window.clearInterval(demoTimer);
    demoTimer = null;
    demoRobot = null;
  },
};
