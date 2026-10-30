# 🛡️ Assistência de Mobilidade + Monitoramento Remoto por Familiar

Sistema IoT completo de ponta a ponta voltado para acessibilidade, segurança e assistência na mobilidade de idosos e pessoas com deficiência visual ou motora. 

Composto por uma **dispositivo inteligente de assistência à mobilidade (ESP32)**, **backend em nuvem (Java / Spring Boot + PostgreSQL)**, **painel web de monitoramento para a família (React + TypeScript)** e **aplicativo móvel (React Native + TypeScript)**.

Dentro de casa, um **robô assistente autônomo (ROS 2 Jazzy + Nav2 + SLAM)** patrulha os cômodos e, quando a bengala detecta uma queda ou SOS, vai sozinho até a pessoa. A família acompanha tudo numa **planta 3D com Realidade Aumentada (three.js + WebXR)**.

> 🏆 **NEXUS / ExpoTech 2026.2**: veja como cada requisito é atendido em [`docs/NEXUS.md`](docs/NEXUS.md),
> o relatório de pentest em [`docs/PENTEST.md`](docs/PENTEST.md) e a arquitetura em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

---

## 🏗️ Estrutura do Repositório

```text
├── firmware-esp32/       # Firmware C/C++ para ESP32 (Arduino / PlatformIO)
│   ├── src/main.cpp      # Leitura de Sensores, Queda, GPS, SOS, BLE e Wi-Fi
│   ├── include/config.h  # Definição de pinos, limiares e credenciais
│   ├── platformio.ini    # Gerenciador de dependências e compilação
│   └── SCHEMATIC_README.md # Diagrama de fiação e pinagem do circuito
│
├── vision-service/       # OpenCV + MediaPipe: metadados do Signal for Help
│   ├── app/              # Detector temporal e API FastAPI
│   └── tests/            # Testes da sequência de duas etapas
│
├── robot-ros2/           # Robô assistente: ROS 2 Jazzy, Gazebo, slam_toolbox, Nav2
│   └── amparo_robot/     # Máquina de estados (State), pipeline do LiDAR, ponte com o backend
│
├── docs/                 # NEXUS, relatório de pentest (CVSS) e arquitetura
│
├── backend/              # API REST Spring Boot 3 + PostgreSQL + Ollama
│   ├── src/main/java/    # Controladores, Serviços, Modelos JPA e DTOs
│   ├── pom.xml           # Dependências Maven
│   └── docker-compose.yml# PostgreSQL 16 + IA local Ollama
│
├── dashboard-web/        # Painel Web do Familiar (React + TypeScript + Vite)
│   ├── src/              # Casa 3D/AR (three.js + WebXR), Mapa Leaflet, Radar, Alertas
│   └── package.json      # Dependências e scripts
│
└── mobile-app/           # Aplicativo Móvel (React Native + TypeScript)
    ├── src/              # Conexão BLE, Botão SOS Rápido, Notificações Push
    └── package.json      # Dependências Expo / React Native
```

---

## ⚡ Guia Rápido de Execução

### 1. 🗄️ Iniciar PostgreSQL e a IA local
Certifique-se de ter o Docker instalado e execute:
```bash
cd backend
docker compose up -d
```
O PostgreSQL estará em `localhost:5432`. A Vision API estará em `localhost:8001`. O Ollama estará em `localhost:11434` e o contêiner de inicialização baixará o modelo `llama3.2:3b` na primeira execução.

Para usar outro modelo:
```bash
OLLAMA_MODEL=qwen2.5:3b docker compose up -d
```

---

### 2. ☕ Iniciar o Backend (Spring Boot)
Dentro da pasta `backend`:
```bash
mvn spring-boot:run
```
A API REST estará rodando em: `http://localhost:8080`

#### 🔐 Segurança (correções do pentest)
Toda a API exige credencial:
- **Família (painel):** login em `POST /api/v1/auth/login` → `Authorization: Bearer <token>`. Usuário padrão `familia` / senha `amparo2050`.
- **Dispositivos (bengala, robô, app da bengala):** cabeçalho `X-API-Key` (padrão `dev-device-key-troque-em-producao`).

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"familia","password":"amparo2050"}' | jq -r .token)
```

Variáveis de ambiente: `ASSISTMOB_FAMILY_USER`, `ASSISTMOB_FAMILY_PASSWORD`, `ASSISTMOB_DEVICE_API_KEY`,
`ASSISTMOB_CORS_ORIGINS`, `POSTGRES_PASSWORD`. `ASSISTMOB_SECURITY_ENABLED=false` desliga a segurança **só para
reproduzir os ataques do relatório**.

#### Principais Endpoints da API:
- `POST /api/v1/telemetry`: Recebe telemetria do ESP32 (GPS, distância, bateria, aceleração).
- `GET /api/v1/telemetry/route/{deviceId}`: Retorna o histórico de trajeto do usuário.
- `POST /api/v1/alerts`: Registra ocorrência de emergência (SOS, Queda, Bateria Fraca).
- `GET /api/v1/alerts/recent/{deviceId}`: Lista os últimos alertas gerados.
- `PATCH /api/v1/alerts/{alertId}/resolve`: Familiar confirma ciência e resolve o alerta.
- `GET /api/v1/dashboard/summary`: Sumário consolidado de métricas e dispositivos para o painel.
- `GET /api/v1/ai/status`: Verifica se a IA local e o modelo estão disponíveis.
- `POST /api/v1/ai/analyze`: Analisa telemetrias e alertas recentes de um dispositivo.
- `POST /api/v1/ai/agent/run`: Executa o agente e cria uma proposta pendente de aprovação.
- `GET /api/v1/ai/agent/actions/{actionId}`: Consulta uma proposta e seu estado.
- `GET /api/v1/ai/agent/actions/device/{deviceId}`: Lista o histórico auditável do agente.
- `PATCH /api/v1/ai/agent/actions/{actionId}/decision`: Aprova ou rejeita a proposta.
- `POST http://localhost:8001/api/v1/vision/analyze`: Analisa um quadro e retorna somente metadados.
- `POST /api/v1/vision/events`: Registra uma confirmação visual e cria uma proposta supervisionada.
- `GET /api/v1/house/layout`: Planta da casa (cômodos, paredes, móveis) usada pelo robô e pelo painel 3D.
- `GET /api/v1/robot/{robotId}/state`: Posição, modo e sensores do robô assistente.
- `POST /api/v1/robot/{robotId}/missions`: Comando da família (`GO_TO_ROOM`, `GO_TO_POINT`, `PATROL`, `RETURN_TO_DOCK`).
- `POST /api/v1/robot/{robotId}/missions/claim` / `.../{id}/complete`: Usados pelo robô (somente `X-API-Key`).
- Alertas `SOS_BUTTON`, `FALL_DETECTED` e `HAND_GESTURE_SOS` criam automaticamente uma missão de socorro para o cômodo informado em `indoorRoom`.

Exemplo de análise local:
```bash
curl -X POST http://localhost:8080/api/v1/ai/analyze \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"deviceId":"ESP32-MOB-001","question":"Existe algum risco agora?","telemetryLimit":10}'
```

A resposta informa o modelo local utilizado e quantas amostras de telemetria e alertas entraram no contexto. Nenhuma informação é enviada para serviços de IA externos. A análise é apenas apoio ao familiar e não substitui avaliação médica ou atendimento de emergência.



### Detecção local do Signal for Help

A câmera envia quadros reduzidos para o serviço local OpenCV. O detector usa pontos da mão e exige a sequência temporal oficial: palma aberta, polegar recolhido e dedos fechando sobre o polegar. Uma mão apenas aberta não dispara o evento.

Os metadados incluem fase, confiança, progresso da sequência, qualidade da imagem, caixa delimitadora normalizada e regras de segurança. Imagens e landmarks não são persistidos. Uma confirmação cria somente uma proposta `CONTACT_PERSON` pendente de aprovação humana; nenhuma ligação é iniciada.

> A detecção é um auxílio e pode apresentar falsos positivos ou falsos negativos. O gesto indica que a pessoa deseja um contato seguro; não comprova violência nem substitui avaliação humana.

Referências: [Signal for Help — Canadian Women’s Foundation](https://canadianwomen.org/signal-for-help/), [OpenCV imdecode](https://docs.opencv.org/4.x/d4/da8/group__imgcodecs.html) e [MediaPipe Hand Landmarker](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/HandLandmarker).

### Agente local supervisionado

O agente observa telemetrias e alertas, avalia o risco e propõe uma única ação. Toda proposta é gravada como `PENDING_APPROVAL`. Ele nunca liga para serviços de emergência e nunca entra em contato com alguém automaticamente.

Criar uma proposta:

```bash
curl -X POST http://localhost:8080/api/v1/ai/agent/run \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"deviceId":"ESP32-MOB-001","objective":"Avalie os riscos atuais","telemetryLimit":10}'
```

Ações permitidas: `NO_ACTION`, `CHECK_PERSON`, `CONTACT_PERSON`, `CHARGE_DEVICE`, `REVIEW_LOCATION`, `CREATE_FAMILY_ALERT` e `CALL_EMERGENCY`.

Aprovar ou rejeitar:

```bash
curl -X PATCH http://localhost:8080/api/v1/ai/agent/actions/1/decision \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"approved":true,"reviewedBy":"Maria","note":"Confirmei a situação por telefone"}'
```

Somente `CREATE_FAMILY_ALERT` produz um efeito automático depois da aprovação: cria um alerta interno para a família. `CALL_EMERGENCY` permanece apenas como orientação e exige ação humana fora do sistema.

Configuração opcional por variáveis de ambiente:
- `OLLAMA_BASE_URL` (padrão: `http://localhost:11434`)
- `OLLAMA_MODEL` (padrão: `llama3.2:3b`)

---

### 3. 🖥️ Iniciar o Painel Web do Familiar (React + TypeScript)
Dentro da pasta `dashboard-web`:
```bash
cd dashboard-web
npm install
npm run dev
```
Acesse no navegador: `http://localhost:3000` e entre com `familia` / `amparo2050`.

A aba **Casa 3D / AR** mostra a planta da casa, o robô em tempo real, a câmera "pelos olhos do robô" e os comandos.
Clique no piso para enviar o robô a um ponto. Para **Realidade Aumentada** no celular (Chrome Android):
```bash
npm run dev:https   # abra https://<ip-do-pc>:3000 no celular e aceite o certificado
```
O painel chama a API por `/api/v1`, e o Vite repassa para `localhost:8080` (sem problema de CORS ou HTTPS no celular).
Se o backend estiver desligado, o painel entra em **modo demonstração** com um robô simulado no navegador.

> 💡 **Recurso Especial**: O Dashboard possui um **Simulador Integrado** no topo da tela, permitindo testar disparos de SOS, simulação de quedas bruscas (MPU6050) e alteração da distância do sensor de ultrassom com visualização instantânea no Radar e no Mapa!

---

### 4. 🤖 Iniciar o Robô Assistente (ROS 2 + Gazebo)
```bash
ros2 launch amparo_robot casa_amparo_sim.launch.py
```
Instalação, compilação e solução de problemas em [`robot-ros2/README.md`](robot-ros2/README.md).

---

### 5. 📱 Iniciar o Aplicativo Móvel (React Native)
Dentro da pasta `mobile-app`:
```bash
cd mobile-app
npm install
npx expo start
```
Abra o aplicativo **Expo Go** no seu smartphone ou inicie no emulador Android/iOS.

---

### 6. 📟 Gravar o Firmware no ESP32
1. Abra a pasta `firmware-esp32` no **VS Code com a extensão PlatformIO** (ou importe o código na **Arduino IDE**).
2. Configure sua rede no arquivo `include/config.h`:
   ```cpp
   #define WIFI_SSID "SUA_REDE_WIFI"
   #define WIFI_PASSWORD "SUA_SENHA_WIFI"
   #define SERVER_BASE_URL "http://SEU_IP_LOCAL:8080/api/v1"
   #define DEVICE_API_KEY "a mesma de ASSISTMOB_DEVICE_API_KEY"
   ```
3. Conecte o ESP32 via USB e clique em **Upload** / `pio run -t upload`.
4. Consulte `firmware-esp32/SCHEMATIC_README.md` para a montagem dos sensores.

### 7. Colaboradores
Guilherme Viana Santos- 104865        
Gustavo Ribeiro - 130363
Juan Pablo - 39511
João Vitor da Silva Batista - 97021
