// Cena 3D da casa (three.js puro, orientado a objetos).
// A classe cria e atualiza tudo que aparece no painel: planta, robô, pessoa, rota, LiDAR,
// a visão "pelos olhos do robô" e a sessão de Realidade Aumentada (WebXR).
import * as THREE from 'three';
import { furnitureModel, personModel, robotModel } from './models';
import { pessoaLivre, planPersonPath, planRobotPath, pontoLivre, pontoLivreDaPessoa } from '../../robot/furnitureNavigation';
import { roomDecorations, type VisualFurniture } from './decorations';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { HouseLayout, Point2D, RobotState } from '../../types/robot';
import { VELOCIDADE_PESSOA, roomAt, tipoComodo, variante } from '../../robot/houseLayout';
import { floorFragmentShader, floorVertexShader, lidarFragmentShader, lidarVertexShader } from './shaders';

const LIDAR_RADIUS = 3.5; // alcance do LDS do TurtleBot3
const HELPERS_LAYER = 1; // objetos só da visão de cima (não aparecem na câmera do robô)
const AR_SCALE = 0.07; // casa de 10 m vira uma maquete de 70 cm na mesa
const PERSON_BOB = 0.025; // balanço vertical da passada (m)

/** Cor do piso por tipo de cômodo; quartos e banheiros variam o tom pelo número ("quarto-2"). */
const ROOM_COLORS: Record<string, string[]> = {
  sala: ['#e8eef6'],
  jantar: ['#f2ede4'],
  cozinha: ['#eef3e9'],
  quarto: ['#f3ece6', '#eee6dc', '#f0eaef', '#ebe9e0'],
  banheiro: ['#e6f1f3', '#e3eee8', '#e8ecf4'],
  escritorio: ['#efeaf4'],
  servico: ['#eef1f3']
};
const floorColor = (roomId: string) => {
  const cores = ROOM_COLORS[tipoComodo(roomId)];
  return cores ? cores[variante(roomId) % cores.length]! : '#eeeeee';
};

const MODE_COLORS: Record<RobotState['mode'], string> = {
  IDLE: '#94a3b8',
  PATROLLING: '#22c55e',
  RESPONDING: '#ef4444',
  CHECKING_PERSON: '#f59e0b',
  GOING_TO_GOAL: '#3b82f6',
  RETURNING: '#a855f7',
  OFFLINE: '#64748b'
};

export interface HouseSceneOptions {
  container: HTMLElement;
  eyesContainer: HTMLElement;
  layout: HouseLayout;
  onFloorClick: (point: Point2D) => void;
  onARChange?: (active: boolean) => void;
}

export interface PersonInfo {
  roomId: string | null;
  emergency: boolean;
  fallen: boolean;
  /** Nome exibido no rótulo (padrão: José). */
  name?: string;
  gender?: 'MALE' | 'FEMALE';
}

type FloorMaterial = THREE.ShaderMaterial & { userData: { roomId: string } };

export class HouseScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly eyesRenderer: THREE.WebGLRenderer;
  private readonly labelRenderer = new CSS2DRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly robotCamera = new THREE.PerspectiveCamera(72, 16 / 10, 0.05, 30);
  private readonly controls: OrbitControls;
  private readonly root = new THREE.Group(); // tudo da casa fica aqui (é ele que escala no AR)
  private readonly floors: THREE.Mesh[] = [];
  private readonly robot = new THREE.Group();
  private readonly robotRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly lidar: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private readonly robotLabel: CSS2DObject;
  private readonly person = new THREE.Group();
  private personVisual = personModel();
  private personGender: 'MALE' | 'FEMALE' = 'MALE';
  private readonly personLabel: CSS2DObject;
  private readonly target: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly pending: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly path: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
  private readonly pendingShadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  /** Animações próprias da cena (no loop do three.js, não no GSAP): queda do anel e rota se desenhando. */
  private pendingDrop: { start: number } | null = null;
  private pathDraw: { start: number; points: THREE.Vector3[] } | null = null;
  private goalKey: string | null = null;
  private readonly hemi = new THREE.HemisphereLight('#ffffff', '#8899aa', 1.3);
  private readonly sun = new THREE.DirectionalLight('#ffffff', 1.6);
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly center: Point2D;
  private readonly viewScale: number;

  /** Caminhada da pessoa: pontos ainda a percorrer (coordenadas locais), giro atual e estado. */
  private personRoute: THREE.Vector3[] = [];
  private personGoalKey: string | null = null;
  private personYaw = 0;
  private personTargetYaw = 0;
  private personFallen = false;
  private personPlaced = false;

  private robotRoute: Point2D[] | null = null;
  private pose = { x: 0, y: 0, yaw: 0 };
  private targetPose = { x: 0, y: 0, yaw: 0 };
  private lidarEnabled = true;
  private robotOnline = false;
  private inAR = false;
  private pointerDown: { x: number; y: number } | null = null;

  constructor(private readonly options: HouseSceneOptions) {
    const { container, eyesContainer, layout } = options;
    const xs = layout.rooms.flatMap(r => [r.minX, r.maxX]);
    const ys = layout.rooms.flatMap(r => [r.minY, r.maxY]);
    this.center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };

    // --- renderizadores
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.className = 'house3d-labels';
    container.appendChild(this.labelRenderer.domElement);

    this.eyesRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.eyesRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    eyesContainer.appendChild(this.eyesRenderer.domElement);

    // --- câmera e controles (casas largas: a vista inicial se afasta para caber a casa inteira)
    this.viewScale = Math.max(1, layout.width / 14.5, layout.depth / 8);
    this.camera.position.set(0, 10.5 * this.viewScale, 8.5 * this.viewScale);
    this.camera.layers.enable(HELPERS_LAYER);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minDistance = 4;
    this.controls.maxDistance = Math.max(22, 18 * this.viewScale);
    this.controls.target.set(0, 0, 0);

    // --- luz (sombra via shadow map da luz direcional)
    this.sun.position.set(-6, 12, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -8; s.right = 8; s.top = 8; s.bottom = -8; s.near = 1; s.far = 30;
    this.scene.add(this.hemi, this.sun, this.root);

    // --- casa
    this.buildHouse(layout);

    // --- robô
    this.robotRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 }));
    this.lidar = new THREE.Mesh(
      new THREE.CircleGeometry(LIDAR_RADIUS, 96),
      new THREE.ShaderMaterial({
        vertexShader: lidarVertexShader,
        fragmentShader: lidarFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uRadius: { value: LIDAR_RADIUS },
          uObstacle: { value: -1 },
          uBeamColor: { value: new THREE.Color('#22d3ee') },
          uObstacleColor: { value: new THREE.Color('#fb923c') }
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.robotLabel = this.label('', 'house3d-label house3d-label-robot');
    this.buildRobot();

    // --- pessoa (usuário da bengala)
    this.personLabel = this.label('Pessoa', 'house3d-label house3d-label-person');
    this.buildPerson();

    // --- destino, ponto clicado e rota prevista
    this.target = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 12, 48), new THREE.MeshBasicMaterial({ color: '#3b82f6' }));
    this.target.rotation.x = -Math.PI / 2;
    this.target.visible = false;
    this.pending = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 12, 48), new THREE.MeshBasicMaterial({ color: '#f59e0b' }));
    this.pending.rotation.x = -Math.PI / 2;
    this.pending.visible = false;
    this.path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#3b82f6', dashSize: 0.22, gapSize: 0.14 }));
    this.path.visible = false;
    this.pendingShadow = new THREE.Mesh(new THREE.CircleGeometry(0.27, 40), new THREE.MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0, depthWrite: false }));
    this.pendingShadow.rotation.x = -Math.PI / 2;
    this.pendingShadow.visible = false;
    [this.target, this.pending, this.pendingShadow, this.path].forEach(o => { o.layers.set(HELPERS_LAYER); this.root.add(o); });

    this.applyColors();

    // --- eventos
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resizeObserver.observe(eyesContainer);
    this.resize();

    // Comando espacial em AR: tocar na maquete envia o robô para o ponto tocado
    const controller = this.renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      const rotation = new THREE.Matrix4().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      const point = this.pickFloor();
      if (point) this.options.onFloorClick(point);
    });
    this.scene.add(controller);

    this.renderer.setAnimationLoop(this.render);
  }

  // ------------------------------------------------------------------ API pública

  setRobot(state: RobotState, avoidFurniture = false) {
    this.targetPose = { x: state.x, y: state.y, yaw: state.yaw };
    if (!this.robot.userData.placed) {
      this.pose = { ...this.targetPose };
      this.robot.userData.placed = true;
    }
    this.robotRoute = avoidFurniture ? planRobotPath(this.options.layout, this.pose, this.targetPose).slice(1) : null;
    const color = MODE_COLORS[state.mode] ?? '#94a3b8';
    this.robotRing.material.color.set(color);
    this.lidar.material.uniforms.uObstacle.value = state.online && state.nearestObstacleM != null ? state.nearestObstacleM : -1;
    this.robotOnline = state.online;
    this.lidar.visible = state.online && this.lidarEnabled;
    const obstacle = state.nearestObstacleM != null ? ` · obstáculo ${state.nearestObstacleM.toFixed(2)} m` : '';
    this.robotLabel.element.textContent = state.online ? `Robô · ${state.navStatus ?? state.mode}${obstacle}` : 'Robô fora do ar';
    this.robotLabel.element.style.borderColor = color;
  }

  setPerson(info: PersonInfo) {
    const gender = info.gender ?? 'MALE';
    if (gender !== this.personGender) {
      this.person.remove(this.personVisual);
      this.personVisual.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        materials.forEach(material => material.dispose());
      });
      this.personGender = gender;
      this.personVisual = personModel(gender);
      this.person.add(this.personVisual);
    }
    const { layout } = this.options;
    const room = layout.rooms.find(r => r.id === info.roomId);
    this.person.visible = !!room;
    if (!room) { this.personRoute = []; this.personGoalKey = null; this.personPlaced = false; return; }
    const { x, y } = pontoLivreDaPessoa(layout, room);
    const key = `${room.id}:${x.toFixed(2)},${y.toFixed(2)}`;
    let here = this.toMap(this.person.position);
    // Parada dentro de um móvel ou colada numa parede (ex.: ao carregar): vai para o ponto livre mais próximo
    if (this.personPlaced && !this.personRoute.length && !pessoaLivre(layout, here)) {
      here = pontoLivre(layout, here);
      this.person.position.x = this.toLocal(here.x, here.y, 0).x;
      this.person.position.z = this.toLocal(here.x, here.y, 0).z;
    }

    if (!this.personPlaced) {
      // Primeira aparição: já no lugar, sem animar
      this.placePerson(x, y);
    } else if (info.fallen) {
      // Queda: a caminhada para onde ela está. Se não estava andando e está em outro cômodo, vai direto.
      if (!this.personRoute.length && roomAt(layout, here)?.id !== room.id) this.placePerson(x, y);
      this.personRoute = [];
    } else if (key !== this.personGoalKey || (!this.personRoute.length && Math.hypot(here.x - x, here.y - y) > 0.05)) {
      // Cômodo novo (ou levantou fora do lugar): rota pelo meio das portas, desviando dos móveis.
      // Sem passagem livre, ela fica onde está (nunca atravessa parede nem móvel).
      this.personRoute = planPersonPath(layout, here, { x, y }).slice(1).map(p => this.toLocal(p.x, p.y, 0));
    }
    this.personGoalKey = key;
    this.personFallen = info.fallen;

    this.person.userData.emergency = info.emergency;
    this.personLabel.element.textContent = info.emergency ? (info.fallen ? 'Queda detectada' : 'Pedido de socorro') : info.name ?? 'José';
    this.personLabel.element.classList.toggle('is-emergency', info.emergency);
    // Onda de alerta no piso: centrada onde a pessoa realmente está
    const at = this.toMap(this.person.position);
    const alertRoom = roomAt(layout, at)?.id ?? room.id;
    this.floors.forEach(floor => {
      const material = floor.material as FloorMaterial;
      material.uniforms.uAlert.value = info.emergency && material.userData.roomId === alertRoom ? 1 : 0;
      material.uniforms.uAlertCenter.value.set(at.x, at.y);
    });
  }

  private placePerson(x: number, y: number) {
    this.person.position.copy(this.toLocal(x, y, 0));
    this.personRoute = [];
    this.personPlaced = true;
  }

  setGoal(goal: Point2D | null, route: Point2D[], color = '#3b82f6') {
    this.target.visible = !!goal;
    this.path.visible = !!goal && route.length > 1;
    const key = goal ? `${goal.x.toFixed(2)},${goal.y.toFixed(2)}` : null;
    const novoDestino = key !== this.goalKey;
    this.goalKey = key;
    if (!goal) { this.pathDraw = null; return; }
    this.target.position.copy(this.toLocal(goal.x, goal.y, 0.03));
    this.target.material.color.set(color);
    this.path.material.color.set(color);
    const points = route.map(p => this.toLocal(p.x, p.y, 0.04));
    // Destino novo (não na abertura da cena): a rota se desenha do robô até o destino em 500 ms
    if (novoDestino && this.clock.elapsedTime > 1 && !reducedMotion()) this.pathDraw = { start: this.clock.elapsedTime, points };
    else if (this.pathDraw) this.pathDraw.points = points;
    if (!this.pathDraw) this.setPathPoints(points);
  }

  setPendingPoint(point: Point2D | null) {
    const novo = !!point && (!this.pending.visible || !this.pending.position.equals(this.toLocal(point.x, point.y, 0.03)));
    this.pending.visible = !!point;
    this.pendingShadow.visible = !!point;
    if (!point) { this.pendingDrop = null; return; }
    this.pending.position.copy(this.toLocal(point.x, point.y, 0.03));
    this.pendingShadow.position.copy(this.toLocal(point.x, point.y, 0.012));
    // O anel "cai" no piso: escala 1,4 → 1 e a sombra aparece (300 ms)
    if (novo && !reducedMotion()) this.pendingDrop = { start: this.clock.elapsedTime };
    else { this.pendingDrop = null; this.pending.scale.setScalar(1); this.pendingShadow.material.opacity = 0.22; }
  }

  /** Posição na tela (px, relativa ao contêiner) de um ponto da planta, para a interface se ancorar nele. */
  project(point: Point2D): { x: number; y: number } | null {
    const v = this.root.localToWorld(this.toLocal(point.x, point.y, 0.03)).project(this.camera);
    if (v.z > 1) return null;
    const { clientWidth: w, clientHeight: h } = this.renderer.domElement;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
  }

  private setPathPoints(points: THREE.Vector3[]) {
    this.path.geometry.dispose();
    this.path.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.path.computeLineDistances();
  }

  private animateHelpers(t: number) {
    if (this.pendingDrop) {
      const p = Math.min(1, (t - this.pendingDrop.start) / 0.3);
      const e = easeOutExpo(p);
      this.pending.scale.setScalar(1.4 - 0.4 * e);
      this.pending.position.y = 0.03 + 0.3 * (1 - e);
      this.pendingShadow.material.opacity = 0.22 * e;
      this.pendingShadow.scale.setScalar(0.7 + 0.3 * e);
      if (p >= 1) this.pendingDrop = null;
    }
    if (this.pathDraw) {
      const p = Math.min(1, (t - this.pathDraw.start) / 0.5);
      this.setPathPoints(truncatePath(this.pathDraw.points, easeInOutSine(p)));
      if (p >= 1) this.pathDraw = null;
    }
  }

  setHighlightRoom(roomId: string | null) {
    this.floors.forEach(floor => {
      const material = floor.material as FloorMaterial;
      material.uniforms.uHighlight.value = material.userData.roomId === roomId ? 1 : 0;
    });
  }

  /** Camada LiDAR (toggle do painel). */
  setLidarVisible(on: boolean) {
    this.lidarEnabled = on;
    this.lidar.visible = on && this.robotOnline;
  }

  /** Aproxima (< 1) ou afasta (> 1) a câmera em relação ao alvo, respeitando os limites dos controles. */
  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
    this.controls.update();
  }

  /** Volta para a vista inicial da casa. */
  recentralizar() {
    this.camera.position.set(0, 10.5 * this.viewScale, 8.5 * this.viewScale);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }


  static async isARSupported(): Promise<boolean> {
    try {
      return !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar');
    } catch {
      return false;
    }
  }

  async enterAR(overlay: HTMLElement): Promise<void> {
    if (!navigator.xr) throw new Error('WebXR indisponível neste navegador.');
    const init = { optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: overlay } } as XRSessionInit;
    const session = await navigator.xr.requestSession('immersive-ar', init);
    this.renderer.xr.setReferenceSpaceType('local');
    await this.renderer.xr.setSession(session);
    this.setARMode(true);
    session.addEventListener('end', () => this.setARMode(false));
  }

  exitAR() {
    void this.renderer.xr.getSession()?.end();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(material) ? material : material ? [material] : []).forEach(m => m.dispose());
    });
    this.renderer.dispose();
    this.eyesRenderer.dispose();
    canvas.remove();
    this.eyesRenderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  // ------------------------------------------------------------------ construção

  private buildHouse(layout: HouseLayout) {
    layout.rooms.forEach(room => {
      const w = room.maxX - room.minX;
      const h = room.maxY - room.minY;
      const cx = (room.minX + room.maxX) / 2;
      const cy = (room.minY + room.maxY) / 2;
      const material = new THREE.ShaderMaterial({
        vertexShader: floorVertexShader,
        fragmentShader: floorFragmentShader,
        uniforms: {
          uRoomCenter: { value: new THREE.Vector2(cx, cy) },
          uColor: { value: new THREE.Color() },
          uLineColor: { value: new THREE.Color() },
          uTime: { value: 0 },
          uHighlight: { value: 0 },
          uAlert: { value: 0 },
          uAlertCenter: { value: new THREE.Vector2() }
        }
      }) as FloorMaterial;
      material.userData.roomId = room.id;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      floor.rotation.x = -Math.PI / 2;
      floor.position.copy(this.toLocal(cx, cy, 0));
      this.floors.push(floor);
      this.root.add(floor);
      this.root.add(this.at(this.label(room.name, 'house3d-label house3d-label-room'), cx, cy, 0.05));
    });

    // Sombras: o ShaderMaterial do piso não recebe sombra, então um plano ShadowMaterial fica logo acima
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(layout.width + 2, layout.depth + 2), new THREE.ShadowMaterial({ opacity: 0.22 }));
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.002;
    shadowPlane.receiveShadow = true;
    this.root.add(shadowPlane);

    const thickness = 0.15;
    layout.walls.forEach(w => {
      const length = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) + thickness;
      const material = new THREE.MeshStandardMaterial({ roughness: 0.85 });
      const mx = (w.x1 + w.x2) / 2;
      const my = (w.y1 + w.y2) / 2;
      const room = layout.rooms.find(r => mx >= r.minX - 0.01 && mx <= r.maxX + 0.01 && my >= r.minY - 0.01 && my <= r.maxY + 0.01);
      const palette: Record<string, string> = { sala: '#a7b8a2', jantar: '#c4b394', cozinha: '#e3c59f', quarto: '#cfa58e', banheiro: '#9dbfc1', escritorio: '#a2adb9', servico: '#adbcc0' };
      material.color.set(palette[room?.id.replace(/-\d+$/, '') ?? ''] ?? '#d9cdbb');
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length, layout.wallHeight, thickness), material);
      wall.position.copy(this.toLocal((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, layout.wallHeight / 2));
      wall.rotation.y = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.root.add(wall);
    });

    const furnishings: VisualFurniture[] = [...layout.furniture, ...roomDecorations(layout)];
    furnishings.forEach(f => {
      const model = furnitureModel(f, layout);
      if (f.yaw != null) model.rotation.y = f.yaw;
      model.position.copy(this.toLocal(f.x, f.y, 0));
      this.root.add(model);
    });
  }

  private buildRobot() {
    this.robot.add(robotModel());

    this.robotRing.rotation.x = -Math.PI / 2;
    this.robotRing.position.y = 0.01;
    this.lidar.rotation.x = -Math.PI / 2;
    this.lidar.position.y = 0.02;
    [this.robotRing, this.lidar].forEach(o => { o.layers.set(HELPERS_LAYER); this.robot.add(o); });

    // "Pelos olhos do robô": câmera presa na frente do robô, olhando para onde ele anda (+x)
    this.robotCamera.position.set(0.2, 0.24, 0);
    this.robotCamera.rotation.set(0, -Math.PI / 2, 0);
    this.robot.add(this.robotCamera);

    this.robotLabel.position.set(0, 0.55, 0);
    this.robot.add(this.robotLabel);
    this.root.add(this.robot);
  }

  private buildPerson() {
    this.person.add(this.personVisual);
    this.personLabel.position.set(0, 1.7, 0);
    this.person.add(this.personLabel);
    this.person.visible = false;
    this.root.add(this.person);
  }

  // ------------------------------------------------------------------ quadro a quadro

  private readonly render = () => {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    // Interpolação suave entre as amostras de pose que chegam da API (~1 Hz)
    const k = Math.min(1, dt * 5);
    if (this.robotRoute) {
      let previous: Point2D = this.pose;
      let remaining = 0;
      for (const point of this.robotRoute) { remaining += Math.hypot(point.x - previous.x, point.y - previous.y); previous = point; }
      let travel = remaining * k;
      while (this.robotRoute.length && travel > 0) {
        const next = this.robotRoute[0]!;
        const distance = Math.hypot(next.x - this.pose.x, next.y - this.pose.y);
        if (distance <= travel) {
          this.pose.x = next.x; this.pose.y = next.y; travel -= distance; this.robotRoute.shift();
        } else {
          this.pose.x += (next.x - this.pose.x) * travel / distance;
          this.pose.y += (next.y - this.pose.y) * travel / distance;
          travel = 0;
        }
      }
    } else {
      this.pose.x += (this.targetPose.x - this.pose.x) * k;
      this.pose.y += (this.targetPose.y - this.pose.y) * k;
    }
    this.pose.yaw += Math.atan2(Math.sin(this.targetPose.yaw - this.pose.yaw), Math.cos(this.targetPose.yaw - this.pose.yaw)) * k;
    this.robot.position.copy(this.toLocal(this.pose.x, this.pose.y, 0));
    this.robot.rotation.y = this.pose.yaw;
    this.animatePerson(dt, t);

    this.lidar.material.uniforms.uTime.value = t;
    this.floors.forEach(f => { (f.material as THREE.ShaderMaterial).uniforms.uTime.value = t; });

    this.animateHelpers(t);

    if (!this.inAR) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (!this.inAR) this.labelRenderer.render(this.scene, this.camera);

    // Segunda passada de renderização com a câmera do robô (sem os objetos de ajuda da camada 1)
    if (!this.inAR) this.eyesRenderer.render(this.scene, this.robotCamera);
  };

  /** Pessoa andando pela rota: velocidade constante, de frente para onde vai, com passada leve. */
  private animatePerson(dt: number, t: number) {
    const p = this.person.position;
    let walking = false;
    if (!this.personFallen) {
      let step = VELOCIDADE_PESSOA * dt;
      while (step > 0 && this.personRoute.length) {
        const next = this.personRoute[0]!;
        const dx = next.x - p.x, dz = next.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4) {
          this.personTargetYaw = Math.atan2(dx, dz); // o modelo olha para +z
          walking = true;
        }
        if (d <= step) { p.x = next.x; p.z = next.z; step -= d; this.personRoute.shift(); }
        else { p.x += dx / d * step; p.z += dz / d * step; step = 0; }
      }
    }
    const k = Math.min(1, dt * 6);
    this.personYaw += Math.atan2(Math.sin(this.personTargetYaw - this.personYaw), Math.cos(this.personTargetYaw - this.personYaw)) * k;
    if (this.personFallen) {
      this.person.rotation.set(0, this.personYaw, Math.PI / 2);
      p.y = 0.16;
      return;
    }
    const sway = walking && !reducedMotion();
    const bob = sway ? Math.abs(Math.sin(t * 8)) * PERSON_BOB : 0;
    const lean = sway ? Math.sin(t * 8) * 0.04 : 0;
    p.y += (bob - p.y) * Math.min(1, dt * 20);
    this.person.rotation.set(0, this.personYaw, this.person.rotation.z + (lean - this.person.rotation.z) * Math.min(1, dt * 10));
  }

  // ------------------------------------------------------------------ auxiliares

  /** Planta (x, y em metros) -> coordenadas locais da cena (x, altura, -y), com a casa centralizada. */
  private toLocal(x: number, y: number, height: number) {
    return new THREE.Vector3(x - this.center.x, height, -(y - this.center.y));
  }

  private toMap(local: THREE.Vector3): Point2D {
    return { x: local.x + this.center.x, y: -local.z + this.center.y };
  }

  private at<T extends THREE.Object3D>(object: T, x: number, y: number, h: number): T {
    object.position.copy(this.toLocal(x, y, h));
    return object;
  }

  private label(text: string, className: string) {
    const div = document.createElement('div');
    div.className = className;
    div.textContent = text;
    return new CSS2DObject(div);
  }

  private pickFloor(): Point2D | null {
    const hit = this.raycaster.intersectObjects(this.floors, false)[0];
    if (!hit) return null;
    return this.toMap(this.root.worldToLocal(hit.point.clone()));
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    const start = this.pointerDown;
    this.pointerDown = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return; // foi arrasto (girar câmera)
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const point = this.pickFloor();
    if (point) this.options.onFloorClick(point);
  };

  private resize() {
    const { container, eyesContainer } = this.options;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    if (!this.inAR) this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const ew = Math.max(1, eyesContainer.clientWidth);
    const eh = Math.max(1, eyesContainer.clientHeight);
    this.eyesRenderer.setSize(ew, eh);
    this.robotCamera.aspect = ew / eh;
    this.robotCamera.updateProjectionMatrix();
  }

  private setARMode(on: boolean) {
    this.inAR = on;
    this.root.scale.setScalar(on ? AR_SCALE : 1);
    this.root.position.set(0, on ? -0.35 : 0, on ? -0.9 : 0);
    this.labelRenderer.domElement.style.display = on ? 'none' : '';
    this.applyColors();
    if (!on) this.resize();
    this.options.onARChange?.(on);
  }

  private applyColors() {
    this.scene.background = this.inAR ? null : new THREE.Color('#f4f6f9');
    this.eyesRenderer.setClearColor('#dfe7f1');

    this.hemi.intensity = 1.3;
    this.floors.forEach(floor => {
      const material = floor.material as FloorMaterial;
      material.uniforms.uColor.value.set(floorColor(String(material.userData.roomId)));
      material.uniforms.uLineColor.value.set('#c3ccd8');
    });
  }
}

// ------------------------------------------------------------------ animação (mesma curva do resto do Amparo)

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Aproximação de cubic-bezier(0.16, 1, 0.3, 1). */
const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const easeInOutSine = (p: number) => -(Math.cos(Math.PI * p) - 1) / 2;

/** Primeiros `f` (0–1) do comprimento de uma polilinha. */
function truncatePath(points: THREE.Vector3[], f: number): THREE.Vector3[] {
  if (f >= 1 || points.length < 2) return points;
  const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]!));
  let left = lengths.reduce((a, b) => a + b, 0) * f;
  const out = [points[0]!];
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (left >= len) { out.push(points[i + 1]!); left -= len; continue; }
    out.push(points[i]!.clone().lerp(points[i + 1]!, len ? left / len : 0));
    break;
  }
  return out.length > 1 ? out : [points[0]!, points[0]!.clone()];
}
