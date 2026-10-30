// Tipos do robô assistente e da planta da casa (espelham os DTOs do backend).

export type RobotMode =
  | 'IDLE'
  | 'PATROLLING'
  | 'RESPONDING'
  | 'CHECKING_PERSON'
  | 'GOING_TO_GOAL'
  | 'RETURNING'
  | 'OFFLINE';

export type MissionType = 'RESPOND_TO_ALERT' | 'GO_TO_ROOM' | 'GO_TO_POINT' | 'RETURN_TO_DOCK' | 'PATROL';
export type MissionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Point2D {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  targetX: number;
  targetY: number;
}

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Furniture {
  name: string;
  roomId: string;
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
  height: number;
}

export interface HouseLayout {
  name: string;
  width: number;
  depth: number;
  wallHeight: number;
  dock: Point2D;
  rooms: Room[];
  walls: Wall[];
  furniture: Furniture[];
  patrolRoute: string[];
}

export interface RobotMission {
  id: number;
  robotId: string;
  type: MissionType;
  priority: number;
  status: MissionStatus;
  targetRoom?: string | null;
  targetX?: number | null;
  targetY?: number | null;
  alertId?: number | null;
  reason?: string | null;
  requestedBy?: string | null;
  resultMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface RobotState {
  robotId: string;
  online: boolean;
  x: number;
  y: number;
  yaw: number;
  mode: RobotMode;
  currentRoom?: string | null;
  batteryPercent?: number | null;
  nearestObstacleM?: number | null;
  navStatus?: string | null;
  currentMission?: RobotMission | null;
  personRoom?: string | null;
  lastUpdate?: string | null;
}

export interface MissionRequest {
  type: Exclude<MissionType, 'RESPOND_TO_ALERT'>;
  targetRoom?: string;
  targetX?: number;
  targetY?: number;
  reason?: string;
}
