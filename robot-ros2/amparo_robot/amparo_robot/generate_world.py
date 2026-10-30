"""Gera worlds/casa_amparo.sdf (Gazebo Harmonic) a partir de house_layout.py.

Uso:  ros2 run amparo_robot generate_world  [caminho_de_saida.sdf]
(ou python3 -m amparo_robot.generate_world). O arquivo já vem gerado no repositório.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from .house_layout import FURNITURE, WALL_HEIGHT, WALL_THICKNESS, WALLS

FURNITURE_COLOR = "0.55 0.42 0.30 1"
WALL_COLOR = "0.93 0.91 0.87 1"


def box_link(name: str, x: float, y: float, z: float, yaw: float, sx: float, sy: float, sz: float, color: str) -> str:
    return f"""      <link name="{name}">
        <pose>{x:.3f} {y:.3f} {z:.3f} 0 0 {yaw:.4f}</pose>
        <collision name="collision"><geometry><box><size>{sx:.3f} {sy:.3f} {sz:.3f}</size></box></geometry></collision>
        <visual name="visual">
          <geometry><box><size>{sx:.3f} {sy:.3f} {sz:.3f}</size></box></geometry>
          <material><ambient>{color}</ambient><diffuse>{color}</diffuse></material>
        </visual>
      </link>"""


def build_sdf() -> str:
    links = []
    for i, w in enumerate(WALLS):
        length = math.hypot(w.x2 - w.x1, w.y2 - w.y1) + WALL_THICKNESS
        yaw = math.atan2(w.y2 - w.y1, w.x2 - w.x1)
        links.append(box_link(f"parede_{i}", (w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, WALL_HEIGHT / 2, yaw,
                              length, WALL_THICKNESS, WALL_HEIGHT, WALL_COLOR))
    for i, f in enumerate(FURNITURE):
        links.append(box_link(f"movel_{i}_{f.room_id}", f.x, f.y, f.height / 2, 0.0,
                              f.size_x, f.size_y, f.height, FURNITURE_COLOR))
    body = "\n".join(links)
    return f"""<?xml version="1.0" ?>
<!-- Gerado por amparo_robot/generate_world.py a partir de house_layout.py. Não edite à mão. -->
<sdf version="1.8">
  <world name="casa_amparo">
    <physics name="1ms" type="ignored">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
    </physics>
    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"/>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"/>
    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors">
      <render_engine>ogre2</render_engine>
    </plugin>
    <plugin filename="gz-sim-imu-system" name="gz::sim::systems::Imu"/>

    <light type="directional" name="sol">
      <cast_shadows>true</cast_shadows>
      <pose>0 0 10 0 0 0</pose>
      <diffuse>0.9 0.9 0.9 1</diffuse>
      <specular>0.2 0.2 0.2 1</specular>
      <direction>-0.5 0.1 -0.9</direction>
    </light>

    <model name="piso">
      <static>true</static>
      <link name="link">
        <collision name="collision"><geometry><plane><normal>0 0 1</normal><size>40 40</size></plane></geometry></collision>
        <visual name="visual">
          <geometry><plane><normal>0 0 1</normal><size>40 40</size></plane></geometry>
          <material><ambient>0.75 0.75 0.75 1</ambient><diffuse>0.75 0.75 0.75 1</diffuse></material>
        </visual>
      </link>
    </model>

    <model name="casa_amparo">
      <static>true</static>
{body}
    </model>
  </world>
</sdf>
"""


def main() -> None:
    default = Path(__file__).resolve().parent.parent / "worlds" / "casa_amparo.sdf"
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_sdf(), encoding="utf-8")
    print(f"Mundo gerado em {out}")


if __name__ == "__main__":
    main()
