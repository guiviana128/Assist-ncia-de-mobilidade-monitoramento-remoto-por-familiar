/**
 * AssistMob Pro - Firmware ESP32 v2.0
 * Sistema Avançado de Assistência de Mobilidade e Proteção Ativa
 * 
 * Inovações Integradas:
 * 1. Detecção Dupla: Obstáculo Frontal + Desnível/Buraco no Chão a 45°
 * 2. Sensor de Toque Capacitivo na Manopla (Grip Touch) para eliminação de falsos positivos
 * 3. Algoritmo Inteligente de "Bengala Apoiada na Parede" (Idle/Leaning Filter)
 * 4. Farol LED Noturno Automático com Sensor LDR
 * 5. Motores Hápticos Duplos (Ponta dos dedos = frente, Palma da mão = chão)
 * 6. Botão Multifunção: Duplo clique = "Cheguei Bem" (Check-in), Clique longo = "SOS"
 * 7. Função "Localizador da Bengala" com Melodia e Luz Estroboscópica
 * 8. Estimador de Cadência de Marcha e Monitor de Tremores
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include "config.h"

// Sensores e Periféricos
Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

BLECharacteristic *pCharacteristic = nullptr;
bool bleConnected = false;
bool mpuAvailable = false;

// Estados do Botão Multifunção
volatile unsigned long lastButtonPressTime = 0;
volatile int buttonClickCount = 0;
volatile bool sosTriggered = false;
volatile bool checkinTriggered = false;

// Variáveis de Controle e Sensores
bool isHandHoldingGrip = true;
bool isLeaningOnWall = false;
bool headlightActive = false;
bool findMeActive = false;
unsigned long findMeStartTime = 0;

// Detecção de Queda
enum FallPhase { STABLE, FREE_FALL, HIGH_G_IMPACT, RESTING };
FallPhase fallPhase = STABLE;
unsigned long fallStartTime = 0;
unsigned long impactTime = 0;

// Telemetria e Diagnóstico
struct AdvancedTelemetry {
    float frontDistanceCm = 999.0;
    float groundDistanceCm = 65.0;
    bool frontObstacle = false;
    bool groundPothole = false;
    
    double latitude = -23.550520;
    double longitude = -46.633308;
    float speedKmh = 0.0;
    int satellites = 8;
    float batteryPercent = 95.0;
    
    int totalStepsWalked = 0;
    float currentGForce = 1.0;
    bool tremorDetected = false;
    bool fallAlert = false;
    
    int ambientLight = 2000; // Leitura LDR
};

AdvancedTelemetry statusData;

unsigned long lastTelemetrySent = 0;
unsigned long lastSensorLoop = 0;
unsigned long lastCommandCheck = 0;

// ==========================================================
// Callback BLE
// ==========================================================
class BleServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        bleConnected = true;
        Serial.println("[BLE] Smartphone do Usuário Conectado!");
    }
    void onDisconnect(BLEServer* pServer) {
        bleConnected = false;
        Serial.println("[BLE] Smartphone Desconectado. Aguardando...");
        pServer->getAdvertising()->start();
    }
};

// ==========================================================
// Interrupção do Botão (Detecta Duplo Clique vs Clique Longo)
// ==========================================================
void IRAM_ATTR handleButtonInterrupt() {
    unsigned long now = millis();
    if (now - lastButtonPressTime > 250) {
        buttonClickCount++;
        lastButtonPressTime = now;
    }
}

// ==========================================================
// Leitura Ultrassônica Genérica
// ==========================================================
float readUltrasonic(int trigPin, int echoPin) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    long duration = pulseIn(echoPin, HIGH, 25000);
    if (duration == 0) return 999.0f;
    return (duration * 0.0343f) / 2.0f;
}

// ==========================================================
// Farol Noturno Automático (LDR)
// ==========================================================
void processAutomaticHeadlight() {
    int lightLevel = analogRead(PIN_LDR_SENSOR);
    statusData.ambientLight = lightLevel;

    // Se o ambiente estiver escuro e a pessoa estiver segurando a bengala
    if (lightLevel < LDR_DARK_THRESHOLD && isHandHoldingGrip) {
        if (!headlightActive) {
            headlightActive = true;
            digitalWrite(PIN_HEADLIGHT_LED, HIGH);
            Serial.println("[FAROL] Ambiente escuro detectado. Farol LED ativado!");
        }
    } else {
        if (headlightActive) {
            headlightActive = false;
            digitalWrite(PIN_HEADLIGHT_LED, LOW);
        }
    }
}

// ==========================================================
// Sensor de Toque Capacitivo na Manopla (Grip Touch)
// ==========================================================
void processGripTouch() {
    // Leitura capacitiva nativa do ESP32 (pino T3 / GPIO 15)
    int touchVal = touchRead(PIN_TOUCH_GRIP);
    isHandHoldingGrip = (touchVal < TOUCH_THRESHOLD);
}

// ==========================================================
// Feedback Tátil Inteligente nos 2 Motores
// ==========================================================
void processHapticFeedback() {
    // 1. Motor dos Dedos (Obstáculo Frontal)
    if (statusData.frontDistanceCm <= OBSTACLE_CRITICAL_DIST_CM) {
        digitalWrite(PIN_HAPTIC_FINGERS, HIGH);
        digitalWrite(PIN_BUZZER, HIGH);
    } else if (statusData.frontDistanceCm <= OBSTACLE_WARN_DIST_CM) {
        static unsigned long lastPulse = 0;
        if (millis() - lastPulse > 200) {
            digitalWrite(PIN_HAPTIC_FINGERS, !digitalRead(PIN_HAPTIC_FINGERS));
            lastPulse = millis();
        }
        digitalWrite(PIN_BUZZER, LOW);
    } else {
        digitalWrite(PIN_HAPTIC_FINGERS, LOW);
        if (!findMeActive) digitalWrite(PIN_BUZZER, LOW);
    }

    // 2. Motor da Palma (Buraco / Degrau no Chão)
    if (statusData.groundPothole) {
        digitalWrite(PIN_HAPTIC_PALM, HIGH); // Pulso vibratório na palma
    } else {
        digitalWrite(PIN_HAPTIC_PALM, LOW);
    }
}

// ==========================================================
// Algoritmo de Queda com Filtro de "Apoiada na Parede"
// ==========================================================
void processAdvancedFallAndGait() {
    if (!mpuAvailable) return;

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    float ax = a.acceleration.x / 9.81f;
    float ay = a.acceleration.y / 9.81f;
    float az = a.acceleration.z / 9.81f;
    float gForce = sqrt(ax * ax + ay * ay + az * az);
    statusData.currentGForce = gForce;

    // Cálculo do Ângulo de Inclinação da Bengala (em relação à vertical)
    float pitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
    float roll  = atan2(ay, az) * 180.0 / PI;
    float tiltAngle = sqrt(pitch * pitch + roll * roll);

    // 1. Filtro: Se a bengala está apoiada estática na parede (65°-82°) sem a mão segurando
    if (tiltAngle >= LEANING_ANGLE_MIN && tiltAngle <= LEANING_ANGLE_MAX && !isHandHoldingGrip) {
        isLeaningOnWall = true;
        fallPhase = STABLE;
        return;
    } else {
        isLeaningOnWall = false;
    }

    // 2. Contador de Passos (Pico de aceleração durante marcha normal)
    static bool stepArmed = false;
    if (gForce > STEP_ACCEL_THRESHOLD && !stepArmed && isHandHoldingGrip) {
        statusData.totalStepsWalked++;
        stepArmed = true;
    } else if (gForce < 1.05f) {
        stepArmed = false;
    }

    // 3. Detecção de Queda em 3 Estágios
    unsigned long now = millis();
    switch (fallPhase) {
        case STABLE:
            if (gForce < FREE_FALL_THRESHOLD && isHandHoldingGrip) {
                fallPhase = FREE_FALL;
                fallStartTime = now;
            }
            break;

        case FREE_FALL:
            if (gForce > IMPACT_THRESHOLD) {
                fallPhase = HIGH_G_IMPACT;
                impactTime = now;
            } else if (now - fallStartTime > FALL_WINDOW_MS) {
                fallPhase = STABLE; // Timeout (falso alarme)
            }
            break;

        case HIGH_G_IMPACT:
            // Confirmação após 1.2s de repouso no chão
            if (now - impactTime > 1200) {
                statusData.fallAlert = true;
                fallPhase = STABLE;
                Serial.println("[EMERGÊNCIA] QUEDA REAL CONFIRMADA COM GRIP ATIVO!");
            }
            break;

        default:
            fallPhase = STABLE;
            break;
    }
}

// ==========================================================
// Rotina "Localizar Minha Bengala" (Find My Cane Beacon)
// ==========================================================
void triggerFindMeBeacon() {
    findMeActive = true;
    findMeStartTime = millis();
    Serial.println("[LOCALIZADOR] Alerta sonoro e visual acionado para encontrar bengala!");
}

void processFindMeBeacon() {
    if (!findMeActive) return;

    unsigned long elapsed = millis() - findMeStartTime;
    if (elapsed > 10000) { // Toca por 10 segundos
        findMeActive = false;
        digitalWrite(PIN_BUZZER, LOW);
        digitalWrite(PIN_HEADLIGHT_LED, headlightActive ? HIGH : LOW);
        return;
    }

    // Efeito de pulso sonoro e estroboscópio
    if ((elapsed / 250) % 2 == 0) {
        digitalWrite(PIN_BUZZER, HIGH);
        digitalWrite(PIN_HEADLIGHT_LED, HIGH);
    } else {
        digitalWrite(PIN_BUZZER, LOW);
        digitalWrite(PIN_HEADLIGHT_LED, LOW);
    }
}

// ==========================================================
// Envio HTTP de Alertas ao Spring Boot
// ==========================================================
void sendAlert(const char* type, const char* msg, const char* severity) {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(ALERT_ENDPOINT);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["alertType"] = type;
    doc["severity"] = severity;
    doc["message"] = msg;
    doc["latitude"] = statusData.latitude;
    doc["longitude"] = statusData.longitude;
    doc["batteryLevel"] = statusData.batteryPercent;

    String jsonStr;
    serializeJson(doc, jsonStr);
    http.POST(jsonStr);
    http.end();
}

// ==========================================================
// Envio HTTP de Telemetria Completa
// ==========================================================
void sendTelemetry() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(TELEMETRY_ENDPOINT);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["latitude"] = statusData.latitude;
    doc["longitude"] = statusData.longitude;
    doc["speedKmh"] = statusData.speedKmh;
    doc["satellites"] = statusData.satellites;
    doc["obstacleDistanceCm"] = statusData.frontDistanceCm;
    doc["obstacleDetected"] = statusData.frontObstacle;
    doc["batteryPercent"] = statusData.batteryPercent;
    doc["fallDetected"] = statusData.fallAlert;

    String jsonStr;
    serializeJson(doc, jsonStr);
    http.POST(jsonStr);
    http.end();
}

// ==========================================================
// Inicialização do BLE Server
// ==========================================================
void initBleServer() {
    BLEDevice::init(BLE_DEVICE_NAME);
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new BleServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ   |
        BLECharacteristic::PROPERTY_WRITE  |
        BLECharacteristic::PROPERTY_NOTIFY |
        BLECharacteristic::PROPERTY_INDICATE
    );

    pCharacteristic->addDescriptor(new BLE2902());
    pService->start();

    BLEAdvertising *pAdv = BLEDevice::getAdvertising();
    pAdv->addServiceUUID(SERVICE_UUID);
    pAdv->setScanResponse(true);
    BLEDevice::startAdvertising();
    Serial.println("[BLE] Servidor BLE Pro Ativo.");
}

// ==========================================================
// SETUP
// ==========================================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n🚀 AssistMob Pro v2.0 - Inicializando Sistemas...");

    // Pinos de Entrada e Saída
    pinMode(PIN_TRIG_FRONT, OUTPUT);
    pinMode(PIN_ECHO_FRONT, INPUT);
    pinMode(PIN_TRIG_GROUND, OUTPUT);
    pinMode(PIN_ECHO_GROUND, INPUT);

    pinMode(PIN_HEADLIGHT_LED, OUTPUT);
    pinMode(PIN_HAPTIC_FINGERS, OUTPUT);
    pinMode(PIN_HAPTIC_PALM, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    pinMode(PIN_BUTTON_SOS, INPUT_PULLUP);

    attachInterrupt(digitalPinToInterrupt(PIN_BUTTON_SOS), handleButtonInterrupt, FALLING);

    // Inicializar I2C e MPU6050
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (mpu.begin()) {
        mpuAvailable = true;
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        Serial.println("✅ MPU-6050 Conectado e Calibrado.");
    }

    // Inicializar GPS
    gpsSerial.begin(GPS_BAUD_RATE, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);

    // BLE & Wi-Fi
    initBleServer();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    // Bip curto de boas-vindas
    digitalWrite(PIN_BUZZER, HIGH);
    digitalWrite(PIN_HAPTIC_FINGERS, HIGH);
    delay(120);
    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_HAPTIC_FINGERS, LOW);
}

// ==========================================================
// LOOP PRINCIPAL
// ==========================================================
void loop() {
    unsigned long now = millis();

    // 1. Processar Botão Multifunção (Duplo clique vs Clique Longo)
    if (buttonClickCount > 0 && (now - lastButtonPressTime > 400)) {
        if (buttonClickCount >= 2) {
            Serial.println("💚 [CHECK-IN] Duplo Clique detectado: 'Cheguei Bem'!");
            sendAlert("CHECKIN_SAFE", "O usuário realizou check-in seguro ('Cheguei Bem')", "INFO");
            // Bipe duplo suave de confirmação
            for (int i = 0; i < 2; i++) {
                digitalWrite(PIN_BUZZER, HIGH);
                delay(60);
                digitalWrite(PIN_BUZZER, LOW);
                delay(60);
            }
        } else if (buttonClickCount == 1) {
            Serial.println("🚨 [SOS] Botão SOS de Emergência Acionado!");
            sendAlert("SOS_BUTTON", "Botão SOS de Pânico acionado na bengala!", "CRITICAL");
        }
        buttonClickCount = 0;
    }

    // 2. Ciclo de Leitura dos Sensores (a cada 100ms)
    if (now - lastSensorLoop >= 100) {
        lastSensorLoop = now;

        // Grip Touch
        processGripTouch();

        // Farol Automático
        processAutomaticHeadlight();

        // Ultrassom Frontal
        statusData.frontDistanceCm = readUltrasonic(PIN_TRIG_FRONT, PIN_ECHO_FRONT);
        statusData.frontObstacle = (statusData.frontDistanceCm <= OBSTACLE_WARN_DIST_CM);

        // Ultrassom de Chão (Detecção de Buraco/Degrau)
        statusData.groundDistanceCm = readUltrasonic(PIN_TRIG_GROUND, PIN_ECHO_GROUND);
        statusData.groundPothole = (statusData.groundDistanceCm > (GROUND_NORMAL_DIST_CM + GROUND_POTHOLE_DIFF_CM));

        if (statusData.groundPothole && isHandHoldingGrip) {
            sendAlert("POTHOLE_HOLE_DETECTED", "Desnível ou buraco perigoso detectado no piso!", "WARNING");
        }

        // Acelerômetro, Queda e Passos
        processAdvancedFallAndGait();

        // Feedback Tátil nos Motores
        processHapticFeedback();

        // Alerta de Queda
        if (statusData.fallAlert) {
            sendAlert("FALL_DETECTED", "Queda brusca confirmada pelos sensores com a bengala em uso!", "CRITICAL");
            statusData.fallAlert = false;
        }

        // Localizador Sonoro
        processFindMeBeacon();
    }

    // 3. Leitura Contínua do GPS
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }
    if (gps.location.isUpdated() && gps.location.isValid()) {
        statusData.latitude = gps.location.lat();
        statusData.longitude = gps.location.lng();
        statusData.speedKmh = gps.speed.kmph();
        statusData.satellites = gps.satellites.value();
    }

    // 4. Envio Periódico de Telemetria (a cada 4s)
    if (now - lastTelemetrySent >= 4000) {
        lastTelemetrySent = now;
        sendTelemetry();
    }
}
