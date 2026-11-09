// API do robô assistente e da planta da casa.
// Se o backend estiver offline (erro de rede), usa o robô simulado no navegador (modo demonstração).
import type {
  HouseLayout,
  MissionRequest,
  RobotMission,
  RobotState,
} from "../types/robot";
import { DemoRobot } from "../robot/demoRobot";
import { chavePlanta, comodosDaPessoa } from "../robot/houseLayout";
import { cuidado, plantaDaFamilia } from "../lib/cuidado";
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
let demoChave = "";
let usingDemo = false;

/**
 * Planta usada pela demonstração: a da família (gerada pelo modelo do cadastro) ou, se ela não
 * tiver, a de exemplo. Assim a Casa 3D, o Início e o robô simulado mostram a casa cadastrada.
 */
const plantaDemo = () => plantaDaFamilia(cuidado.get());

function pararSimulado() {
  if (demoTimer !== null) window.clearInterval(demoTimer);
  demoTimer = null;
  demoRobot = null;
  demoChave = "";
}

const isNetworkError = (error: unknown) =>
  !auth.isLoggedIn() &&
  (error instanceof ApiError
    ? error.offline
    : !(error instanceof AuthRequiredError));

function demo(): DemoRobot {
  const planta = plantaDemo();
  // A família trocou a planta: o robô simulado recomeça na planta nova.
  if (demoRobot && demoChave !== chavePlanta(planta)) pararSimulado();
  if (!demoRobot) {
    demoRobot = new DemoRobot(planta, ROBOT_ID);
    demoChave = chavePlanta(planta);
    const rooms = comodosDaPessoa(planta);
    let last = performance.now();
    let elapsed = 0;
    let roomIndex = 0;
    demoTimer = window.setInterval(() => {
      const now = performance.now();
      demoRobot!.tick(Math.min(0.5, (now - last) / 1000));
      elapsed += (now - last) / 1000;
      if (elapsed >= 8) {
        elapsed = 0;
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
      () => plantaDemo(),
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

  requestPhysicalMission: async (request: MissionRequest) =>
    apiJson<RobotMission>(`/robot/${await familyRobot()}/missions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }),

  requestMission: (request: MissionRequest) =>
    withDemo(
      () => robotApi.requestPhysicalMission(request),
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
    pararSimulado();
  },
};
