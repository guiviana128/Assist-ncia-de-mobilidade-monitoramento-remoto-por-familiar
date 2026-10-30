# Arquitetura do código: paradigmas e Design Patterns

> Requisito NEXUS: **Arquitetura de Código**. O sistema usa explicitamente pelo menos dois paradigmas,
> com justificativa, e pelo menos um Design Pattern nomeado e justificado.

## Visão geral

```mermaid
flowchart LR
  B[Bengala ESP32<br/>C++] -- HTTP + X-API-Key --> API
  APP[App da bengala<br/>React Native] -- X-API-Key --> API
  subgraph Backend [Backend Java / Spring Boot]
    API[Controllers] --> AS[AlertService]
    AS -- AlertCreatedEvent<br/>(Observer) --> RMS[RobotMissionService]
    API --> RMS
    AS & RMS --> DB[(PostgreSQL)]
  end
  subgraph ROS [Robô ROS 2 Jazzy / Python]
    MM[mission_manager_node] --> SM[RobotContext<br/>(State)]
    MM --> NAV[Nav2 + slam_toolbox]
    SCAN[/scan LiDAR/] --> PIPE[scan_pipeline<br/>(funcional)] --> MM
  end
  MM -- HTTP: estado, claim, complete --> API
  NAV --> GZ[Gazebo: casa Amparo]
  WEB[Painel React + three.js<br/>3D / AR / WebXR] -- Bearer token --> API
```

**Fluxo principal (queda):** a bengala envia `FALL_DETECTED` com o cômodo → o `AlertService` salva e publica
`AlertCreatedEvent` → o `RobotMissionService` (ouvinte) cria a missão `RESPOND_TO_ALERT` → o robô pede
a próxima missão (`claim`), o `RobotContext` troca para o estado `RespondingState` e manda o objetivo ao Nav2 →
ao chegar, reporta `complete` → o backend gera o alerta `ROBOT_ARRIVED` → o painel 3D mostra o robô ao lado
da pessoa e a câmera "pelos olhos do robô".

---

## Paradigma 1: Orientação a Objetos

**Onde:**
- Backend Java inteiro: entidades JPA (`Alert`, `RobotMission`), serviços com responsabilidade única
  (`AlertService`, `RobotMissionService`, `HouseLayoutService`, `TokenService`) e injeção de dependência pelo construtor.
- Robô: `robot-ros2/amparo_robot/amparo_robot/state_machine.py` tem uma classe por estado
  (`PatrollingState`, `RespondingState`, `CheckingPersonState`...), uma hierarquia com herança
  (`MissionNavigationState` → `GoingToGoalState`, `RespondingState`, `ReturningState`) e o contexto `RobotContext`.
- Painel: `dashboard-web/src/components/house3d/HouseScene.ts` encapsula toda a cena 3D numa classe
  com estado privado (pose, câmeras, renderizadores) e métodos públicos (`setRobot`, `setPerson`, `enterAR`).

**Por quê:** os componentes do robô e do sistema **têm estado e identidade**: um robô está patrulhando, uma missão
está em andamento. Os objetos juntam esse estado com o comportamento que depende dele, e o encapsulamento impede
que outras partes coloquem o robô num estado inválido (só o `RobotContext` troca o estado atual).

## Paradigma 2: Funcional

**Onde:**
- `robot-ros2/amparo_robot/amparo_robot/scan_pipeline.py`: o processamento do LiDAR é uma composição de
  **funções puras** (`to_readings` → `filter(valid(...))` → `closest` com `reduce` → `sector_of`), sem estado
  e sem efeitos colaterais. `valid(range_min, range_max)` é uma **função de ordem superior** (devolve um
  predicado), e o resultado é um `ObstacleSummary` **imutável** (`@dataclass(frozen=True)`).
- Java: os DTOs novos são `record` imutáveis (`RobotStateDTO`, `HouseLayoutDTO`), e as consultas usam Streams com
  `filter` / `map` / `max` (`RobotMissionService.claimNext`, `HouseLayoutService.roomAt`).
- React: componentes são funções do estado (`UI = f(estado)`), com hooks e sem mutação direta.

**Por quê:** os dados de sensor chegam em alta frequência (10 Hz no LiDAR), e cada leitura é independente.
Funções puras são **determinísticas e fáceis de testar sem o ROS** (`test/test_scan_pipeline.py`), não têm
condição de corrida e podem rodar em qualquer thread. Imutabilidade evita que uma leitura seja alterada no meio
do caminho por outro callback.

> Resumindo: **OOP para modelar os componentes com estado (robô, missões, cena 3D)** e
> **funcional para o pipeline de sensores e para as transformações de dados**.

---

## Design Patterns

### 1. State (principal)
`state_machine.py`: cada modo do robô é uma classe com os próprios `enter`, `on_nav_result` e `tick`.
O `RobotContext` delega o evento para o estado atual e troca de estado com `transition()`.
**Justificativa:** sem o pattern, o nó teria um `if/elif` gigante por modo em cada evento. Com ele, acrescentar um
modo novo (ex.: "carregando bateria") é criar uma classe, sem mexer nas outras. Os estados também definem
**quem pode interromper quem** (`min_claim_priority`): socorro não é interrompido, comando manual é.
O mesmo conjunto de modos existe no Java (`RobotMode`) e no front (`RobotState['mode']`).

### 2. Observer
`AlertService` publica `AlertCreatedEvent` (`ApplicationEventPublisher` do Spring), e o
`RobotMissionService.onAlertCreated` escuta (`@EventListener`).
**Justificativa:** o serviço de alertas não precisa conhecer o robô. Amanhã outro ouvinte (SMS, e-mail, outra IA)
pode reagir ao mesmo evento sem alterar o `AlertService` (princípio aberto/fechado) e sem dependência circular.

### 3. Template Method
`MissionNavigationState.on_nav_result` define o algoritmo fixo ("chegou? → `on_arrived`; falhou? → tenta de novo
até `max_retries`; desistiu? → `on_gave_up`") e as subclasses só sobrescrevem os passos (`RespondingState.on_arrived`
vai para `CheckingPersonState`; `ReturningState.target` usa a base).

### 4. Repository e DTO
`RobotMissionRepository` (Spring Data) isola o acesso ao banco, e os DTOs (`RobotMissionDTO.fromEntity`) separam o
formato da API do modelo persistido. Assim a entidade pode mudar sem quebrar o painel ou o robô.

---

## Testes

| Onde | O que cobre | Como rodar |
|---|---|---|
| `robot-ros2/amparo_robot/test/` | máquina de estados, pipeline do LiDAR e planta igual entre Python e Java | `colcon test --packages-select amparo_robot` ou `python3 -m pytest robot-ros2/amparo_robot/test` |
| `vision-service/tests/` | sequência do gesto de socorro | `pytest` |
