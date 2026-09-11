# 🛡️ Assistência de Mobilidade + Monitoramento Remoto por Familiar

Sistema IoT completo de ponta a ponta voltado para acessibilidade, segurança e assistência na mobilidade de idosos e pessoas com deficiência visual ou motora. 

Composto por uma **bengala inteligente (ESP32)**, **backend em nuvem (Java / Spring Boot + PostgreSQL)**, **painel web de monitoramento para a família (React + TypeScript)** e **aplicativo móvel (React Native + TypeScript)**.

---

## 🏗️ Estrutura do Repositório

```text
├── firmware-esp32/       # Firmware C/C++ para ESP32 (Arduino / PlatformIO)
│   ├── src/main.cpp      # Leitura de Sensores, Queda, GPS, SOS, BLE e Wi-Fi
│   ├── include/config.h  # Definição de pinos, limiares e credenciais
│   ├── platformio.ini    # Gerenciador de dependências e compilação
│   └── SCHEMATIC_README.md # Diagrama de fiação e pinagem do circuito
│
├── backend/              # API REST Spring Boot 3 + PostgreSQL + FCM
│   ├── src/main/java/    # Controladores, Serviços, Modelos JPA e DTOs
│   ├── pom.xml           # Dependências Maven
│   └── docker-compose.yml# Banco de dados PostgreSQL 16
│
├── dashboard-web/        # Painel Web do Familiar (React + TypeScript + Vite)
│   ├── src/              # Mapa Leaflet, Radar Ultrassônico, Alertas em Tempo Real
│   └── package.json      # Dependências e scripts
│
└── mobile-app/           # Aplicativo Móvel (React Native + TypeScript)
    ├── src/              # Conexão BLE, Botão SOS Rápido, Notificações Push
    └── package.json      # Dependências Expo / React Native
```

---

## ⚡ Guia Rápido de Execução

### 1. 🗄️ Iniciar o Banco de Dados (PostgreSQL)
Certifique-se de ter o Docker instalado e execute:
```bash
cd backend
docker compose up -d
```
O PostgreSQL estará disponível em `localhost:5432` com as credenciais `postgres` / `postgres123`.

---

### 2. ☕ Iniciar o Backend (Spring Boot)
Dentro da pasta `backend`:
```bash
mvn spring-boot:run
```
A API REST estará rodando em: `http://localhost:8080`

#### Principais Endpoints da API:
- `POST /api/v1/telemetry`: Recebe telemetria do ESP32 (GPS, distância, bateria, aceleração).
- `GET /api/v1/telemetry/route/{deviceId}`: Retorna o histórico de trajeto do usuário.
- `POST /api/v1/alerts`: Registra ocorrência de emergência (SOS, Queda, Bateria Fraca).
- `GET /api/v1/alerts/recent/{deviceId}`: Lista os últimos alertas gerados.
- `PATCH /api/v1/alerts/{alertId}/resolve`: Familiar confirma ciência e resolve o alerta.
- `GET /api/v1/dashboard/summary`: Sumário consolidado de métricas e dispositivos para o painel.

---

### 3. 🖥️ Iniciar o Painel Web do Familiar (React + TypeScript)
Dentro da pasta `dashboard-web`:
```bash
cd dashboard-web
npm install
npm run dev
```
Acesse no navegador: `http://localhost:3000`

> 💡 **Recurso Especial**: O Dashboard possui um **Simulador Integrado** no topo da tela, permitindo testar disparos de SOS, simulação de quedas bruscas (MPU6050) e alteração da distância do sensor de ultrassom com visualização instantânea no Radar e no Mapa!

---

### 4. 📱 Iniciar o Aplicativo Móvel (React Native)
Dentro da pasta `mobile-app`:
```bash
cd mobile-app
npm install
npx expo start
```
Abra o aplicativo **Expo Go** no seu smartphone ou inicie no emulador Android/iOS.

---

### 5. 📟 Gravar o Firmware no ESP32
1. Abra a pasta `firmware-esp32` no **VS Code com a extensão PlatformIO** (ou importe o código na **Arduino IDE**).
2. Configure sua rede no arquivo `include/config.h`:
   ```cpp
   #define WIFI_SSID "SUA_REDE_WIFI"
   #define WIFI_PASSWORD "SUA_SENHA_WIFI"
   #define SERVER_BASE_URL "http://SEU_IP_LOCAL:8080/api/v1"
   ```
3. Conecte o ESP32 via USB e clique em **Upload** / `pio run -t upload`.
4. Consulte o guia [SCHEMATIC_README.md](file:///c:/TEMP/Assistência de mobilidade + monitoramento remoto por familiar/firmware-esp32/SCHEMATIC_README.md) para a montagem dos sensores.
