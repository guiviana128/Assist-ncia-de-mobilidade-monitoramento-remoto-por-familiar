import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Furniture, HouseLayout } from '../../types/robot';

/** Modelos locais em metros. O grupo externo continua sendo posicionado pela cena. */
class Model {
  readonly group = new THREE.Group();
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  material(color: string, metalness = 0, roughness = 0.72) {
    const key = `${color}/${metalness}/${roughness}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
      this.materials.set(key, material);
    }
    return material;
  }

  mesh(geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, metalness = 0) {
    const mesh = new THREE.Mesh(geometry, this.material(color, metalness));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, radius = 0.025) {
    return this.mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4)), color, x, y, z);
  }

  ball(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
    const mesh = this.mesh(new THREE.SphereGeometry(1, 16, 12), color, x, y, z);
    mesh.scale.set(w / 2, h / 2, d / 2);
    return mesh;
  }

  cylinder(radius: number, height: number, x: number, y: number, z: number, color: string, metalness = 0) {
    return this.mesh(new THREE.CylinderGeometry(radius, radius, height, 20), color, x, y, z, metalness);
  }
}

const wood = '#a87c53';
const cream = '#eee7d9';
const dark = '#273b43';
const fabric = '#6e9995';
const ceramic = '#f5f3ed';

function legs(m: Model, w: number, h: number, d: number) {
  for (const x of [-w * 0.39, w * 0.39]) {
    for (const z of [-d * 0.37, d * 0.37]) m.box(0.055, h, 0.055, x, h / 2, z, wood);
  }
}

function plant(m: Model, x: number, y: number, z: number, scale = 1) {
  m.cylinder(0.09 * scale, 0.15 * scale, x, y + 0.075 * scale, z, '#c07e5f');
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 0.4;
    const leaf = m.ball(0.1 * scale, 0.25 * scale, 0.05 * scale,
      x + Math.sin(angle) * 0.06 * scale, y + 0.23 * scale,
      z + Math.cos(angle) * 0.06 * scale, i % 2 ? '#568572' : '#3f6957');
    leaf.rotation.set(Math.cos(angle) * 0.5, angle, Math.sin(angle) * 0.5);
  }
}

function diningChair(x: number, yaw: number) {
  const chair = new Model();
  legs(chair, 0.36, 0.42, 0.36);
  chair.box(0.36, 0.065, 0.36, 0, 0.45, 0, '#6e9995', 0.035);
  chair.box(0.34, 0.38, 0.045, 0, 0.71, -0.15, '#6e9995', 0.035);
  chair.group.rotation.y = yaw;
  chair.group.position.x = x;
  return chair.group;
}

/** Mantém o contorno horizontal do móvel cadastrado, incluindo modelos antigos. */
export function furnitureModel(f: Furniture & { yaw?: number }, layout?: HouseLayout): THREE.Group {
  const m = new Model();
  const name = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sideways = f.yaw != null ? Math.abs(Math.sin(f.yaw)) > 0.5 : /sofa|rack|guarda|armario/.test(name) && f.sizeY > f.sizeX;
  const w = sideways ? f.sizeY : f.sizeX;
  const d = sideways ? f.sizeX : f.sizeY;
  const h = f.height;

  if (/tapete/.test(name)) {
    m.box(w, 0.006, d, 0, 0.007, 0, '#c6a17a', 0.002);
    m.box(w * 0.9, 0.002, d * 0.87, 0, 0.011, 0, '#e8dac2', 0.001);
    for (const x of [-w * 0.38, w * 0.38]) m.box(0.025, 0.001, d * 0.72, x, 0.0125, 0, '#73938b', 0.0002);
    for (const z of [-d * 0.32, d * 0.32]) m.box(w * 0.77, 0.001, 0.025, 0, 0.0125, z, '#73938b', 0.0002);
    for (let x = -w * 0.4; x <= w * 0.4; x += 0.08) {
      for (const z of [-d * 0.47, d * 0.47]) m.box(0.018, 0.002, d * 0.05, x, 0.009, z, '#f2e9d9', 0.0005);
    }
  } else if (/estante/.test(name)) {
    for (const x of [-w * 0.47, w * 0.47]) m.box(w * 0.06, h, d, x, h / 2, 0, wood);
    m.box(w, h, 0.025, 0, h / 2, -d * 0.45, '#71918b');
    for (let row = 0; row < 4; row++) {
      const y = 0.06 + row * h * 0.29;
      m.box(w, 0.04, d, 0, y, 0, wood);
      if (row < 3) {
        for (let i = 0; i < 4; i++) {
          m.box(w * 0.09, h * (0.13 + i * 0.012), d * 0.7, -w * 0.33 + i * w * 0.11,
            y + h * (0.065 + i * 0.006) + 0.02, 0, ['#b77b60', '#e0cf9f', '#637f89', '#c6ab87'][i]);
        }
      }
    }
    plant(m, w * 0.25, h * 0.65, 0, 0.55);
  } else if (/comoda/.test(name)) {
    legs(m, w, 0.1, d);
    m.box(w, h - 0.1, d, 0, (h + 0.1) / 2, 0, wood);
    for (let i = 0; i < 3; i++) {
      const y = 0.22 + i * (h - 0.16) / 3;
      m.box(w * 0.94, (h - 0.16) / 3 - 0.025, 0.025, 0, y, d / 2 - 0.015, cream);
      m.box(0.14, 0.018, 0.025, 0, y, d / 2 - 0.01, dark);
    }
    plant(m, -w * 0.29, h, 0, 0.75);
    m.box(w * 0.3, 0.25, 0.035, w * 0.25, h + 0.125, -d * 0.1, wood);
    m.box(w * 0.25, 0.2, 0.01, w * 0.25, h + 0.125, -d * 0.1 + 0.024, '#84a7a2');
    m.ball(0.07, 0.07, 0.008, w * 0.28, h + 0.17, -d * 0.1 + 0.032, '#e7c28b');
  } else if (/cama/.test(name)) {
    legs(m, w, 0.12, d);
    m.box(w, 0.16, d, 0, 0.18, 0, wood);
    m.box(w * 0.96, 0.19, d * 0.96, 0, h - 0.08, 0, ceramic, 0.07);
    m.box(w, 0.72, 0.09, 0, 0.4, -d / 2 + 0.045, '#64837d');
    m.box(w * 0.97, 0.055, d * 0.56, 0, h + 0.035, d * 0.18, '#c98865');
    m.box(w * 0.98, 0.065, 0.12, 0, h + 0.055, -d * 0.09, '#dba783');
    for (const x of [-w * 0.24, w * 0.24]) {
      m.box(w * 0.4, 0.13, d * 0.19, x, h + 0.08, -d * 0.31, cream, 0.06);
    }
  } else if (/sofa|poltrona/.test(name)) {
    legs(m, w, 0.12, d);
    m.box(w, h * 0.35, d, 0, h * 0.32, 0, fabric, 0.07);
    m.box(w, h * 0.64, d * 0.18, 0, h * 0.67, -d * 0.4, fabric, 0.06);
    for (const x of [-w * 0.45, w * 0.45]) m.box(w * 0.1, h * 0.5, d, x, h * 0.55, 0, fabric, 0.05);
    for (const x of [-w * 0.23, w * 0.23]) {
      m.box(w * 0.43, h * 0.16, d * 0.72, x, h * 0.53, d * 0.07, '#82a9a2', 0.05);
      const pillow = m.box(w * 0.21, h * 0.34, 0.12, x, h * 0.76, -d * 0.18, cream, 0.05);
      pillow.rotation.z = x > 0 ? -0.14 : 0.14;
    }
  } else if (/rack/.test(name)) {
    legs(m, w, 0.1, d);
    m.box(w, h * 0.76, d, 0, h * 0.55, 0, wood);
    for (const x of [-w * 0.33, 0, w * 0.33]) {
      m.box(w * 0.3, h * 0.5, 0.018, x, h * 0.55, d * 0.5 - 0.01, cream);
      m.box(0.12, 0.018, 0.025, x, h * 0.7, d * 0.5 - 0.012, dark);
    }
    m.box(w * 0.35, 0.035, d * 0.55, 0, h + 0.02, 0, dark);
    m.box(0.055, 0.18, 0.05, 0, h + 0.1, 0, dark);
    m.box(w * 0.88, w * 0.5, 0.055, 0, h + w * 0.29, 0, '#18262c');
    m.box(w * 0.82, w * 0.44, 0.008, 0, h + w * 0.29, 0.032, '#416b76');
    m.box(w * 0.65, w * 0.06, 0.01, 0, h + w * 0.16, 0.038, '#90b5b5');
  } else if (/guarda|armario|criado/.test(name)) {
    m.box(w, h, d, 0, h / 2, 0, wood);
    for (const x of [-w * 0.25, w * 0.25]) {
      m.box(w * 0.48, h * 0.94, 0.025, x, h * 0.5, d / 2 - 0.013, cream);
      m.box(0.025, Math.min(0.22, h * 0.3), 0.035, x * 0.2, h * 0.53, d / 2 - 0.015, dark);
    }
    if (/criado/.test(name)) {
      m.box(w * 0.5, 0.035, d * 0.45, -w * 0.15, h + 0.02, d * 0.2, '#6f9895');
      m.box(w * 0.46, 0.025, d * 0.42, -w * 0.13, h + 0.05, d * 0.2, '#d6b18b');
      m.cylinder(0.08, 0.03, 0, h + 0.015, -d * 0.15, wood);
      m.cylinder(0.015, 0.18, 0, h + 0.1, 0, dark);
      m.mesh(new THREE.ConeGeometry(0.12, 0.16, 24), '#ead8b8', 0, h + 0.25, 0);
    }
  } else if (/bancada|pia/.test(name)) {
    m.box(w * 0.98, h * 0.91, d * 0.94, 0, h * 0.455, 0, '#9faf9d');
    m.box(w, 0.06, d, 0, h - 0.03, 0, cream);
    const doors = Math.max(1, Math.round(w / 0.45));
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + (i + 0.5) * w / doors;
      m.box(w / doors - 0.025, h * 0.79, 0.02, x, h * 0.46, d * 0.47, '#a9b9a6');
      m.box(0.1, 0.018, 0.025, x, h * 0.72, d * 0.48, dark);
    }
    const sinkX = /bancada/.test(name) ? -w * 0.2 : 0;
    m.box(Math.min(0.48, w * 0.7), 0.018, d * 0.64, sinkX, h + 0.005, 0, '#aabbbd');
    m.box(Math.min(0.38, w * 0.56), 0.02, d * 0.46, sinkX, h + 0.009, 0, '#627e82');
    m.cylinder(0.018, 0.23, sinkX, h + 0.115, -d * 0.34, '#b7c5c6', 0.8);
    m.box(0.036, 0.036, d * 0.26, sinkX, h + 0.23, -d * 0.22, '#b7c5c6');
    if (/bancada/.test(name)) {
      m.box(w * 0.3, 0.025, d * 0.8, w * 0.28, h + 0.01, 0, dark);
      for (const x of [w * 0.2, w * 0.36]) for (const z of [-d * 0.2, d * 0.2]) {
        m.cylinder(0.055, 0.015, x, h + 0.03, z, '#819197', 0.7);
      }
    } else {
      m.box(w * 0.8, 0.56, 0.035, 0, h + 0.46, -d * 0.46, wood);
      m.box(w * 0.73, 0.49, 0.012, 0, h + 0.46, -d * 0.42, '#b8d8dc');
    }
  } else if (/cadeira/.test(name)) {
    legs(m, w, 0.43, d);
    m.box(w, 0.07, d, 0, 0.46, 0, '#6e9995', 0.04);
    m.box(w * 0.94, 0.36, 0.065, 0, 0.71, -d * 0.4, '#6e9995', 0.05);
    for (const x of [-w * 0.38, w * 0.38]) m.box(0.035, 0.5, 0.035, x, 0.61, -d * 0.4, wood);
  } else if (/fogao/.test(name)) {
    m.box(w, h, d, 0, h / 2, 0, '#d8dfdb');
    m.box(w * 0.88, h * 0.55, 0.025, 0, h * 0.4, d / 2 - 0.015, dark);
    m.box(w * 0.7, h * 0.36, 0.012, 0, h * 0.4, d / 2, '#425e68');
    m.box(w * 0.7, 0.025, 0.04, 0, h * 0.72, d / 2 - 0.015, '#a9b9bc');
    m.box(w, 0.035, d, 0, h, 0, dark);
    for (const x of [-w * 0.24, w * 0.24]) for (const z of [-d * 0.24, d * 0.24]) {
      m.cylinder(w * 0.14, 0.02, x, h + 0.025, z, '#879b9e', 0.7);
      m.box(w * 0.35, 0.015, 0.018, x, h + 0.04, z, dark);
    }
    for (const x of [-w * 0.3, -w * 0.1, w * 0.1, w * 0.3]) m.ball(0.045, 0.045, 0.03, x, h * 0.86, d / 2, dark);
  } else if (/geladeira/.test(name)) {
    m.box(w, h, d, 0, h / 2, 0, '#d8e1de', 0.045);
    for (const [y, height] of [[h * 0.76, h * 0.45], [h * 0.26, h * 0.48]]) {
      m.box(w * 0.96, height, 0.035, 0, y, d / 2 - 0.018, '#eef0e9');
      m.box(0.025, height * 0.45, 0.035, w * 0.34, y, d / 2 - 0.01, dark);
    }
  } else if (/vaso|privada/.test(name)) {
    m.box(w * 0.82, h * 0.85, d * 0.25, 0, h * 0.55, -d * 0.36, ceramic, 0.07);
    m.ball(w * 0.72, h * 0.55, d * 0.65, 0, h * 0.3, d * 0.08, ceramic);
    m.ball(w * 0.96, 0.13, d * 0.72, 0, h * 0.65, d * 0.1, ceramic);
    m.ball(w * 0.65, 0.025, d * 0.47, 0, h * 0.65 + 0.065, d * 0.1, '#8ba8ad');
    m.box(0.09, 0.015, 0.04, 0, h * 0.98, -d * 0.36, '#9daeb0');
  } else if (/chuveiro/.test(name)) {
    m.box(w, 0.065, d, 0, 0.035, 0, ceramic);
    m.box(w * 0.9, 0.012, d * 0.9, 0, 0.073, 0, '#b5caca');
    m.cylinder(0.018, h * 0.83, -w * 0.35, h * 0.47, -d * 0.35, '#a9bdbe', 0.8);
    m.box(0.035, 0.035, d * 0.35, -w * 0.35, h * 0.88, -d * 0.18, '#a9bdbe');
    m.cylinder(0.1, 0.03, -w * 0.35, h * 0.87, 0, '#738e91', 0.6);
    const glass = m.box(0.018, h * 0.85, d * 0.8, w * 0.48, h * 0.46, -d * 0.08, '#bddedb');
    glass.material = new THREE.MeshStandardMaterial({ color: '#b8d9d8', transparent: true, opacity: 0.24, roughness: 0.18, depthWrite: false });
    glass.castShadow = false;
    m.box(0.025, h * 0.87, 0.025, w * 0.48, h * 0.46, d * 0.32, dark);
  } else if (/mesa|escrivaninha/.test(name)) {
    legs(m, w, h - 0.06, d);
    m.box(w, 0.07, d, 0, h - 0.035, 0, wood);
    if (/escrivaninha/.test(name)) {
      m.box(w * 0.45, 0.025, d * 0.4, 0, h + 0.02, 0, dark);
      m.box(w * 0.45, 0.3, 0.025, 0, h + 0.16, -d * 0.18, dark);
      m.box(w * 0.4, 0.25, 0.008, 0, h + 0.16, -d * 0.15, '#74a0a5');
    } else {
      m.group.add(diningChair(-w * 0.34, Math.PI / 2), diningChair(w * 0.34, -Math.PI / 2));
      m.cylinder(Math.min(w, d) * 0.17, 0.025, 0, h + 0.015, 0, ceramic);
      m.ball(0.1, 0.09, 0.1, 0, h + 0.06, 0, '#cb9661');
    }
    plant(m, w * 0.32, h, -d * 0.24, 0.7);
  } else if (/planta/.test(name)) {
    plant(m, 0, 0, 0, Math.min(w, d) / 0.23);
  } else {
    m.box(w, h, d, 0, h / 2, 0, wood);
    m.box(w * 0.9, h * 0.83, 0.02, 0, h / 2, d / 2 - 0.01, cream);
  }

  let yaw = sideways ? Math.PI / 2 : 0;
  if (layout && f.yaw == null) {
    const room = layout.rooms.find(r => r.id === f.roomId);
    const other = layout.furniture.find(item => item.roomId === f.roomId &&
      (/sofa/.test(name) ? /rack|tv/i.test(item.name) : /rack/.test(name) && /sof/i.test(item.name)));
    const targetX = other?.x ?? (room ? (room.minX + room.maxX) / 2 : f.x);
    const targetY = other?.y ?? (room ? (room.minY + room.maxY) / 2 : f.y);
    // A frente local aponta para +z; no mapa, +y corresponde a -z.
    if (!/cama|cadeira|mesa|escrivaninha|planta/.test(name) &&
        (sideways ? targetX < f.x : targetY > f.y)) yaw += Math.PI;
  }
  yaw = f.yaw ?? yaw;
  // Detalhes superiores podem crescer, mas nunca invadem a circulação lateral.
  m.group.rotation.y = 0;
  const bounds = new THREE.Box3().setFromObject(m.group);
  const size = bounds.getSize(new THREE.Vector3());
  m.group.scale.x = Math.min(1, w / size.x);
  m.group.scale.z = Math.min(1, d / size.z);
  m.group.rotation.y = yaw;
  m.group.name = f.name;
  return m.group;
}

export function personModel(): THREE.Group {
  const m = new Model();
  for (const x of [-0.095, 0.095]) {
    m.box(0.13, 0.12, 0.25, x, 0.07, 0.035, '#34414a', 0.04);
    m.box(0.13, 0.56, 0.15, x, 0.39, 0, '#536777', 0.045);
  }
  m.box(0.33, 0.19, 0.2, 0, 0.67, 0, '#536777', 0.05);
  m.box(0.38, 0.46, 0.23, 0, 0.93, 0, '#ba7757', 0.08);
  m.box(0.025, 0.39, 0.012, 0, 0.94, 0.119, '#e0b292');
  for (const x of [-0.25, 0.25]) {
    const arm = m.box(0.12, 0.35, 0.14, x, 0.96, 0, '#ba7757', 0.05);
    arm.rotation.z = x > 0 ? 0.12 : -0.12;
    m.box(0.09, 0.23, 0.1, x * 1.05, 0.71, 0.02, '#dca785', 0.04);
    m.ball(0.09, 0.12, 0.1, x * 1.05, 0.59, 0.025, '#dca785');
  }
  m.cylinder(0.06, 0.09, 0, 1.19, 0, '#dca785');
  m.ball(0.25, 0.3, 0.23, 0, 1.36, 0, '#dca785');
  m.ball(0.26, 0.15, 0.24, 0, 1.46, -0.015, '#c9c6bb');
  m.ball(0.055, 0.07, 0.06, 0, 1.34, 0.12, '#c99575');
  for (const x of [-0.062, 0.062]) {
    m.box(0.09, 0.065, 0.025, x, 1.38, 0.105, '#4a504d', 0.012);
    m.box(0.064, 0.04, 0.008, x, 1.38, 0.12, '#bed0cf');
  }
  m.box(0.04, 0.016, 0.02, 0, 1.38, 0.12, '#4a504d');
  m.cylinder(0.014, 0.58, 0.28, 0.3, 0.08, dark, 0.5);
  m.box(0.09, 0.035, 0.035, 0.25, 0.59, 0.08, wood);
  m.cylinder(0.025, 0.03, 0.28, 0.015, 0.08, '#17252c');
  return m.group;
}

export function robotModel(): THREE.Group {
  const m = new Model();
  m.cylinder(0.175, 0.055, 0, 0.07, 0, '#23343e', 0.45);
  m.cylinder(0.16, 0.08, 0, 0.125, 0, '#d6dedb', 0.35);
  m.cylinder(0.175, 0.025, 0, 0.175, 0, '#557e7d', 0.5);
  for (const z of [-0.17, 0.17]) {
    const wheel = m.cylinder(0.075, 0.045, 0, 0.075, z, '#1b262b');
    wheel.rotation.x = Math.PI / 2;
    const hub = m.cylinder(0.038, 0.048, 0, 0.075, z, '#97a9ac', 0.7);
    hub.rotation.x = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const tread = m.box(0.022, 0.012, 0.047, Math.sin(angle) * 0.071, 0.075 + Math.cos(angle) * 0.071, z, '#39474c', 0.003);
      tread.rotation.z = -angle;
    }
  }
  for (const x of [-0.1, 0.1]) for (const z of [-0.1, 0.1]) {
    m.cylinder(0.012, 0.075, x, 0.205, z, '#b0babc', 0.8);
  }
  m.cylinder(0.14, 0.018, 0, 0.247, 0, dark, 0.4);
  m.cylinder(0.06, 0.045, -0.025, 0.28, 0, '#1d2a32');
  m.cylinder(0.062, 0.012, -0.025, 0.305, 0, '#79b8ac');
  m.box(0.04, 0.06, 0.12, 0.13, 0.213, 0, dark, 0.01);
  for (const z of [-0.035, 0.035]) {
    const lens = m.cylinder(0.018, 0.012, 0.156, 0.215, z, '#7fced4', 0.6);
    lens.rotation.z = Math.PI / 2;
  }
  for (const z of [-0.075, 0.075]) m.ball(0.02, 0.025, 0.025, 0.15, 0.12, z, '#63cbb1');
  return m.group;
}
