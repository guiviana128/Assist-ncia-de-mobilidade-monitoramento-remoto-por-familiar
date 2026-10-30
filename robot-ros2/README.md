# Robô assistente Amparo (ROS 2 Jazzy)

Pacote `amparo_robot`: TurtleBot3 (waffle) numa casa de 5 cômodos no Gazebo, com **slam_toolbox** (mapa),
**Nav2** (planejamento e desvio de obstáculos) e um nó de decisão que conversa com o backend Amparo.

```
amparo_robot/
├── amparo_robot/
│   ├── mission_manager_node.py  # nó ROS 2: Nav2 (NavigateToPose), TF, /scan, ponte HTTP com o backend
│   ├── state_machine.py         # Design Pattern State: patrulha / socorro / verificação / comandos
│   ├── scan_pipeline.py         # pipeline funcional do LiDAR (funções puras)
│   ├── house_layout.py          # planta da casa (igual ao backend) + rota de patrulha
│   ├── backend_client.py        # cliente HTTP (X-API-Key)
│   └── generate_world.py        # gera worlds/casa_amparo.sdf a partir da planta
├── launch/casa_amparo_sim.launch.py   # Gazebo + robô + SLAM + Nav2 + RViz + nó de decisão
├── launch/mission_manager.launch.py   # só o nó de decisão
├── worlds/casa_amparo.sdf
├── config/amparo_robot.yaml
└── test/                         # pytest (não precisa de ROS)
```

## 1. Instalar (Ubuntu 24.04 + ROS 2 Jazzy)

```bash
sudo apt update
sudo apt install -y ros-jazzy-desktop ros-jazzy-navigation2 ros-jazzy-nav2-bringup \
  ros-jazzy-slam-toolbox ros-jazzy-ros-gz ros-jazzy-turtlebot3-gazebo ros-jazzy-turtlebot3-msgs \
  python3-colcon-common-extensions python3-pytest
echo 'source /opt/ros/jazzy/setup.bash' >> ~/.bashrc
echo 'export TURTLEBOT3_MODEL=waffle' >> ~/.bashrc
source ~/.bashrc
```

> Se `ros-jazzy-turtlebot3-gazebo` não aparecer no apt, compile pelo código-fonte:
> `git clone -b jazzy https://github.com/ROBOTIS-GIT/turtlebot3_simulations.git` dentro de `~/amparo_ws/src`.

## 2. Compilar

```bash
mkdir -p ~/amparo_ws/src
ln -s ~/Documentos/Projetos/amparo-telecuidado/robot-ros2/amparo_robot ~/amparo_ws/src/amparo_robot
cd ~/amparo_ws
colcon build --symlink-install
source install/setup.bash
```

## 3. Rodar

O backend precisa estar rodando (`cd backend && mvn spring-boot:run`).

```bash
ros2 launch amparo_robot casa_amparo_sim.launch.py            # com Gazebo e RViz
ros2 launch amparo_robot casa_amparo_sim.launch.py gui:=false # sem a janela do Gazebo (PC mais fraco)
```

Ordem de inicialização: Gazebo e robô (0 s) → SLAM e Nav2 (5 s) → RViz (7 s) → nó de decisão (10 s).
Quando o Nav2 fica pronto, o robô começa a **patrulhar** sozinho. No painel web (aba *Casa 3D / AR*),
o selo muda para "Robô conectado (ROS 2)".

Testar sem o painel:

```bash
API=http://localhost:8080/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"username":"familia","password":"amparo2050"}' | jq -r .token)
# mandar o robô para a cozinha
curl -s -X POST $API/robot/AMPARO-BOT-01/missions -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"type":"GO_TO_ROOM","targetRoom":"cozinha"}'
# simular uma queda no quarto (o robô deve largar tudo e ir até lá)
curl -s -X POST $API/alerts -H 'X-API-Key: dev-device-key-troque-em-producao' -H 'Content-Type: application/json' \
  -d '{"deviceId":"ESP32-MOB-001","alertType":"FALL_DETECTED","message":"teste","indoorRoom":"quarto"}'
```

## 4. Testes

```bash
cd ~/amparo_ws && colcon test --packages-select amparo_robot && colcon test-result --verbose
# ou, sem ROS: python3 -m pytest robot-ros2/amparo_robot/test
```

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| `TURTLEBOT3_MODEL` não definido | `export TURTLEBOT3_MODEL=waffle` |
| Robô não se mexe, mas o Nav2 diz que planejou | Tipo do `/cmd_vel` diferente (Twist × TwistStamped). Veja `ros2 topic info /cmd_vel -v`. Se o bridge do TurtleBot3 usar `Twist`, rode com `ros2 param set /controller_server enable_stamped_cmd_vel false` (e também em `/velocity_smoother`, `/behavior_server`, `/collision_monitor`) |
| "Sem backend" no log do nó | Backend fora do ar ou `backend_url` errado em `config/amparo_robot.yaml` |
| HTTP 401/403 no log do nó | `api_key` diferente de `ASSISTMOB_DEVICE_API_KEY` do backend |
| Mapa não aparece no RViz | Em *Fixed Frame*, escolha `map`. O SLAM leva alguns segundos para publicar |
| Plano B para a simulação | `ros2 launch nav2_bringup tb3_simulation_launch.py slam:=True world:=$(ros2 pkg prefix amparo_robot)/share/amparo_robot/worlds/casa_amparo.sdf x_pose:=0.0 y_pose:=0.0` e, em outro terminal, `ros2 launch amparo_robot mission_manager.launch.py` |

Para mudar a casa, edite `house_layout.py` **e** `HouseLayoutService.java` (o teste `test_same_layout_as_backend`
avisa se ficarem diferentes) e rode `python3 -m amparo_robot.generate_world` para gerar o `.sdf` de novo.
