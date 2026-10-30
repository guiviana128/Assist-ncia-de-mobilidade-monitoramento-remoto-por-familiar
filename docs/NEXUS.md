# Amparo Telecuidado no NEXUS (6º semestre CDC, ExpoTech 2026.2)

**Tema:** Smart Home 2050, *Assistência de mobilidade + monitoramento remoto por familiar*.

O idoso mora sozinho e usa a **bengala inteligente Amparo** (ESP32). Dentro de casa, um **robô assistente autônomo**
(ROS 2) patrulha os cômodos. Quando a bengala detecta uma **queda** ou a pessoa aperta o **SOS**, o robô interrompe a
patrulha, navega sozinho até o cômodo onde ela está desviando dos obstáculos, e a família acompanha tudo numa
**planta 3D / AR** da casa, vendo inclusive **pelos olhos do robô**.

## Como cada requisito é atendido

| Requisito do PDF | Onde está | Detalhes |
|---|---|---|
| **Navegação autônoma**: SLAM ROS 2, Nav2, desvio de obstáculos dinâmicos e comportamento de decisão | `robot-ros2/amparo_robot` | TurtleBot3 no Gazebo, numa casa de 5 cômodos (`worlds/casa_amparo.sdf`). `slam_toolbox` monta o mapa e o Nav2 planeja e desvia (costmap local). Decisão: patrulhar → **responder a um chamado** (alerta da bengala) → verificar a pessoa → voltar a patrulhar. Comandos da família pelo painel. |
| **Interface imersiva**: AR/VR com a planta e o robô em tempo real, com funcionalidade imersiva real e pipeline gráfico | `dashboard-web/src/components/HouseView3D.tsx` e `house3d/` | three.js + **WebXR (immersive-ar)**: a casa vira uma maquete na mesa. **Visão pelos olhos do robô** (segunda câmera e segunda passada de renderização). **Comando espacial** (clicar ou tocar no piso, no 3D ou no AR, envia o robô). **Sensores sobrepostos** (varredura do LiDAR e anel do obstáculo mais próximo). **Shaders GLSL próprios** (`shaders.ts`), shadow mapping, camadas de renderização e espaço de cor linear para sRGB. |
| **Segurança ofensiva**: pentest com relatório CVSS e pelo menos 2 correções reais | [`docs/PENTEST.md`](PENTEST.md) | 6 achados com CVSS 3.1. Correções aplicadas: **V-01** autenticação e autorização por perfil (9.4 → 3.3), **V-03** banco e IA fora da rede (8.8), **V-04** CORS restrito (5.4), além de validação dos comandos do robô. |
| **Arquitetura de código**: 2 paradigmas + Design Pattern justificado | [`docs/ARQUITETURA.md`](ARQUITETURA.md) | **OOP** (robô, serviços, cena 3D) + **funcional** (pipeline do LiDAR, records e Streams). Patterns: **State** (principal), Observer, Template Method, Repository/DTO. |

## Roteiro de demonstração (5 minutos)

1. **Subir tudo** (ver o README de cada parte):
   `docker compose up -d` (banco) → `mvn spring-boot:run` (backend) →
   `ros2 launch amparo_robot casa_amparo_sim.launch.py` (Gazebo + SLAM + Nav2 + robô) → `npm run dev` (painel).
2. **Login** no painel (`familia` / `amparo2050`) → aba **Casa 3D / AR**: o robô aparece **patrulhando** e o mapa do SLAM cresce no RViz.
3. **Comando espacial:** clique no piso do escritório → *Enviar*. O robô sai (linha azul), e na câmera "pelos olhos do robô" dá para ver o corredor.
4. **Obstáculo dinâmico:** no Gazebo, coloque uma caixa no caminho. O Nav2 recalcula a rota e o painel mostra "obstáculo à frente".
5. **Chamado de socorro:** *Simulador* → cômodo **Quarto** → *Simular queda*. O piso do quarto pulsa em vermelho, o boneco aparece caído,
   o robô **interrompe** o que fazia, vai até o quarto (linha vermelha) e fica **verificando a pessoa**. A família recebe "Robô chegou até a pessoa".
6. **AR:** no celular (Chrome Android), abra `https://<ip-do-pc>:3000` (`npm run dev:https`) → *Ver em AR*. A maquete aparece na mesa, e tocar no piso envia o robô.
7. **Pentest:** mostre o `curl` sem credencial devolvendo **401**, o login com força bruta devolvendo **429** e o `nmap` com as portas 5432/11434 fechadas (`docs/PENTEST.md`).

> Sem ROS 2 ou sem backend, o painel entra sozinho em **modo demonstração**: um robô simulado no navegador
> segue a mesma lógica de patrulha e socorro. Serve para treinar a apresentação, mas na avaliação usem o robô real no Gazebo.

## Perguntas que o professor pode fazer (todos devem saber)

- **Onde está o SLAM?** No `slam_toolbox` (online async), iniciado pelo `casa_amparo_sim.launch.py`. O mapa nasce com origem na posição inicial do robô (0, 0), o mesmo referencial da planta usada pelo backend e pelo painel.
- **Como o robô decide?** Pela máquina de estados (`state_machine.py`) e pelas prioridades: socorro 100 > comando manual 50 > base 20 > patrulha 10.
- **Como o robô sabe o cômodo da pessoa?** A bengala informa `indoorRoom` (num produto real, por beacons BLE em cada cômodo; no protótipo, pelo simulador).
- **Por que isso é AR "de verdade"?** Usa WebXR `immersive-ar` com rastreamento do celular, a cena é renderizada no referencial do mundo real, e o toque vira um raio (raycast) no espaço 3D para comandar o robô.
