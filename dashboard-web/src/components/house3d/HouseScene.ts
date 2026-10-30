// Cena 3D da casa (three.js puro, orientado a objetos).
// A classe cria e atualiza tudo que aparece no painel: planta, robô, pessoa, rota, LiDAR,
// a visão "pelos olhos do robô" e a sessão de Realidade Aumentada (WebXR).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { HouseLayout, Point2D, RobotState } from '../../types/robot';
import { floorFragmentShader, floorVertexShader, lidarFragmentShader, lidarVertexShader } from './shaders';

const LIDAR_RADIUS = 3.5; // alcance do LDS do TurtleBot3
const HELPERS_LAYER = 1; // objetos só da visão de cima (não aparecem na câmera do robô)
const AR_SCALE = 0.07; // casa de 10 m vira uma maquete de 70 cm na mesa

const ROOM_COLORS: Record<string, { light: string; dark: string }> = {
  sala: { light: '#e8eef6', dark: '#1d2a3d' },
  cozinha: { light: '#eef3e9', dark: '#1f2e26' },
  quarto: { light: '#f3ece6', dark: '#2e2621' },
  banheiro: { light: '#e6f1f3', dark: '#1c2d31' },
  escritorio: { light: '#efeaf4', dark: '#27223a' }
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
  dark: boolean;
  onFloorClick: (point: Point2D) => void;
  onARChange?: (active: boolean) => void;
}

export interface PersonInfo {
  roomId: string | null;
  emergency: boolean;
  fallen: boolean;
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
  private readonly wallMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  private readonly furnitureMaterial = new THREE.MeshStandardMaterial({ color: '#b08968', roughness: 0.7 });
  private readonly robot = new THREE.Group();
  private readonly robotRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly lidar: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private readonly robotLabel: CSS2DObject;
  private readonly person = new THREE.Group();
  private readonly personLabel: CSS2DObject;
  private readonly target: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly pending: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly path: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
  private readonly hemi = new THREE.HemisphereLight('#ffffff', '#8899aa', 1.3);
  private readonly sun = new THREE.DirectionalLight('#ffffff', 1.6);
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly center: Point2D;

  private pose = { x: 0, y: 0, yaw: 0 };
  private targetPose = { x: 0, y: 0, yaw: 0 };
  private dark: boolean;
  private inAR = false;
  private pointerDown: { x: number; y: number } | null = null;

  constructor(private readonly options: HouseSceneOptions) {
    const { container, eyesContainer, layout } = options;
    this.dark = options.dark;
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

    // --- câmera e controles
    this.camera.position.set(0, 10.5, 8.5);
    this.camera.layers.enable(HELPERS_LAYER);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 22;
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
    [this.target, this.pending, this.path].forEach(o => { o.layers.set(HELPERS_LAYER); this.root.add(o); });

    this.applyTheme();

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

  setRobot(state: RobotState) {
    this.targetPose = { x: state.x, y: state.y, yaw: state.yaw };
    if (!this.robot.userData.placed) {
      this.pose = { ...this.targetPose };
      this.robot.userData.placed = true;
    }
    const color = MODE_COLORS[state.mode] ?? '#94a3b8';
    this.robotRing.material.color.set(color);
    this.lidar.material.uniforms.uObstacle.value = state.online && state.nearestObstacleM != null ? state.nearestObstacleM : -1;
    this.lidar.visible = state.online;
    const obstacle = state.nearestObstacleM != null ? ` · obstáculo ${state.nearestObstacleM.toFixed(2)} m` : '';
    this.robotLabel.element.textContent = state.online ? `🤖 ${state.navStatus ?? state.mode}${obstacle}` : '🤖 Robô offline';
    this.robotLabel.element.style.borderColor = color;
  }

  setPerson(info: PersonInfo) {
    const room = this.options.layout.rooms.find(r => r.id === info.roomId);
    this.person.visible = !!room;
    if (!room) return;
    const x = Math.min(room.maxX - 0.4, room.targetX + 0.55);
    const y = Math.min(room.maxY - 0.4, room.targetY + 0.35);
    this.person.position.copy(this.toLocal(x, y, 0));
    this.person.rotation.set(0, 0, info.fallen ? Math.PI / 2 : 0);
    this.person.position.y = info.fallen ? 0.16 : 0;
    this.person.userData.emergency = info.emergency;
    this.personLabel.element.textContent = info.emergency ? (info.fallen ? '⚠️ Queda detectada' : '🚨 Pedido de socorro') : '🧓 Usuário da bengala';
    this.personLabel.element.classList.toggle('is-emergency', info.emergency);
    this.floors.forEach(floor => {
      const material = floor.material as FloorMaterial;
      const isRoom = material.userData.roomId === room.id;
      material.uniforms.uAlert.value = info.emergency && isRoom ? 1 : 0;
      material.uniforms.uAlertCenter.value.set(x, y);
    });
  }

  setGoal(goal: Point2D | null, route: Point2D[], color = '#3b82f6') {
    this.target.visible = !!goal;
    this.path.visible = !!goal && route.length > 1;
    if (!goal) return;
    this.target.position.copy(this.toLocal(goal.x, goal.y, 0.03));
    this.target.material.color.set(color);
    this.path.material.color.set(color);
    this.path.geometry.dispose();
    this.path.geometry = new THREE.BufferGeometry().setFromPoints(route.map(p => this.toLocal(p.x, p.y, 0.04)));
    this.path.computeLineDistances();
  }

  setPendingPoint(point: Point2D | null) {
    this.pending.visible = !!point;
    if (point) this.pending.position.copy(this.toLocal(point.x, point.y, 0.03));
  }

  setHighlightRoom(roomId: string | null) {
    this.floors.forEach(floor => {
      const material = floor.material as FloorMaterial;
      material.uniforms.uHighlight.value = material.userData.roomId === roomId ? 1 : 0;
    });
  }

  setDark(dark: boolean) {
    this.dark = dark;
    this.applyTheme();
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
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length, layout.wallHeight, thickness), this.wallMaterial);
      wall.position.copy(this.toLocal((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, layout.wallHeight / 2));
      wall.rotation.y = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.root.add(wall);
    });

    layout.furniture.forEach(f => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(f.sizeX, f.height, f.sizeY), this.furnitureMaterial);
      box.position.copy(this.toLocal(f.x, f.y, f.height / 2));
      box.castShadow = true;
      box.receiveShadow = true;
      this.root.add(box);
    });
  }

  private buildRobot() {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.14, 32), new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.3, roughness: 0.5 }));
    body.position.y = 0.09;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24), new THREE.MeshStandardMaterial({ color: '#0f172a' }));
    top.position.y = 0.19;
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#0e7490', emissiveIntensity: 1.2 }));
    face.position.set(0.17, 0.11, 0);
    [body, top, face].forEach(m => { m.castShadow = true; this.robot.add(m); });

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
    const material = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.85, 20), material);
    body.position.y = 0.43;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), new THREE.MeshStandardMaterial({ color: '#fed7aa' }));
    head.position.y = 1.0;
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8), new THREE.MeshStandardMaterial({ color: '#1e293b' }));
    cane.position.set(0.24, 0.4, 0.05);
    [body, head, cane].forEach(m => { m.castShadow = true; this.person.add(m); });
    this.personLabel.position.set(0, 1.4, 0);
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
    this.pose.x += (this.targetPose.x - this.pose.x) * k;
    this.pose.y += (this.targetPose.y - this.pose.y) * k;
    this.pose.yaw += Math.atan2(Math.sin(this.targetPose.yaw - this.pose.yaw), Math.cos(this.targetPose.yaw - this.pose.yaw)) * k;
    this.robot.position.copy(this.toLocal(this.pose.x, this.pose.y, 0));
    this.robot.rotation.y = this.pose.yaw;

    this.lidar.material.uniforms.uTime.value = t;
    this.floors.forEach(f => { (f.material as THREE.ShaderMaterial).uniforms.uTime.value = t; });
    this.target.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
    this.pending.rotation.z = t * 1.5;
    if (this.person.userData.emergency) {
      this.personLabel.element.style.opacity = String(0.6 + 0.4 * Math.abs(Math.sin(t * 3)));
    }

    if (!this.inAR) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (!this.inAR) this.labelRenderer.render(this.scene, this.camera);

    // Segunda passada de renderização com a câmera do robô (sem os objetos de ajuda da camada 1)
    if (!this.inAR) this.eyesRenderer.render(this.scene, this.robotCamera);
  };

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
    this.applyTheme();
    if (!on) this.resize();
    this.options.onARChange?.(on);
  }

  private applyTheme() {
    const dark = this.dark;
    this.scene.background = this.inAR ? null : new THREE.Color(dark ? '#0b1220' : '#f4f6f9');
    this.eyesRenderer.setClearColor(dark ? '#0b1220' : '#dfe7f1');
    this.wallMaterial.color.set(dark ? '#cbd5e1' : '#f8fafc');
    this.hemi.intensity = dark ? 0.9 : 1.3;
    this.floors.forEach(floor => {
      const material = floor.material as FloorMaterial;
      const palette = ROOM_COLORS[material.userData.roomId] ?? { light: '#eeeeee', dark: '#222222' };
      material.uniforms.uColor.value.set(dark ? palette.dark : palette.light);
      material.uniforms.uLineColor.value.set(dark ? '#3b4a63' : '#c3ccd8');
    });
  }
}
