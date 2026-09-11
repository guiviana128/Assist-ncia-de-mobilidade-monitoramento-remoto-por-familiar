/**
 * Assistência de Mobilidade + Monitoramento Remoto
 * Firmware ESP32 Principal (C/C++ Arduino Framework)
 * 
 * Recursos:
 * - Leitura contínua de ultrassom (HC-SR04) para alerta de obstáculos com Buzzer e Vibração
 * - Detecção de queda em 3 estágios (MPU-6050): Queda Livre -> Impacto -> Inércia
 * - Aquisição de coordenadas de GPS (NEO-6M) via HardwareSerial 2
 * - Interrupção de Botão SOS com prioridade de envio
 * - Conectividade Wi-Fi com envio REST (JSON) para Backend Spring Boot
 * - Servidor BLE para pareamento local e sincronismo com o App React Native
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

// Instâncias de Sensores e Bibliotecas
Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// Variáveis Globais de Estado
volatile bool sosTriggered = false;
volatile unsigned long lastSosInterruptTime = 0;

bool mpuAvailable = false;
bool bleConnected = false;
BLECharacteristic *pCharacteristic = nullptr;

// Detecção de Queda
enum FallState { NORMAL, FREE_FALL_DETECTED, IMPACT_DETECTED };
FallState fallState = NORMAL;
unsigned long freeFallStartTime = 0;
unsigned long impactStartTime = 0;

// Temporizadores
unsigned long lastTelemetryTime = 0;
unsigned long lastSensorReadTime = 0;

// Estrutura de Telemetria Atual
struct DeviceStatus {
    float distanceCm = 999.0;
    double latitude = -23.550520; // Padrão de fallback (SP)
    double longitude = -46.633308;
    float speedKmh = 0.0;
    int satellites = 0;
    float batteryPercent = 100.0;
    bool obstacleWarning = false;
    bool fallDetected = false;
};

DeviceStatus currentStatus;

// ==========================================================
// Callback BLE
// ==========================================================
class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        bleConnected = true;
        Serial.println("[BLE] Cliente conectado!");
    }

    void onDisconnect(BLEServer* pServer) {
        bleConnected = false;
        Serial.println("[BLE] Cliente desconectado. Reiniciando anúncio...");
        pServer->getAdvertising()->start();
    }
};

// ==========================================================
// Interrupção do Botão SOS (com Debounce de 300ms)
// ==========================================================
void IRAM_ATTR handleSosInterrupt() {
    unsigned long interruptTime = millis();
    if (interruptTime - lastSosInterruptTime > 300) {
        sosTriggered = true;
        lastSosInterruptTime = interruptTime;
    }
}

// ==========================================================
// Leitura do Sensor Ultrassônico HC-SR04
// ==========================================================
float readUltrasonicDistance() {
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    long duration = pulseIn(PIN_ECHO, HIGH, 30000); // Timeout de 30ms (~5 metros)
    if (duration == 0) return 999.0f; // Sem eco

    float distance = (duration * 0.0343f) / 2.0f;
    return distance;
}

// ==========================================================
// Processamento de Obstáculos (Feedback Sonoro/Vibratório)
// ==========================================================
void processObstacleFeedback(float distance) {
    if (distance <= OBSTACLE_CRITICAL_DIST_CM) {
        currentStatus.obstacleWarning = true;
        // Bip contínuo e vibração máxima
        digitalWrite(PIN_BUZZER, HIGH);
        digitalWrite(PIN_VIBRATION, HIGH);
    } else if (distance <= OBSTACLE_WARN_DIST_CM) {
        currentStatus.obstacleWarning = true;
        // Bip pulsado proporcional à proximidade
        static unsigned long lastBeep = 0;
        int interval = map((int)distance, (int)OBSTACLE_CRITICAL_DIST_CM, (int)OBSTACLE_WARN_DIST_CM, 100, 400);
        if (millis() - lastBeep > interval) {
            digitalWrite(PIN_BUZZER, !digitalRead(PIN_BUZZER));
            digitalWrite(PIN_VIBRATION, !digitalRead(PIN_VIBRATION));
            lastBeep = millis();
        }
    } else {
        currentStatus.obstacleWarning = false;
        digitalWrite(PIN_BUZZER, LOW);
        digitalWrite(PIN_VIBRATION, LOW);
    }
}

// ==========================================================
// Leitura e Algoritmo de Queda MPU-6050
// ==========================================================
void processFallDetection() {
    if (!mpuAvailable) return;

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Magnitude da Aceleração em 'g' (1g ≈ 9.81 m/s²)
    float ax = a.acceleration.x / 9.81f;
    float ay = a.acceleration.y / 9.81f;
    float az = a.acceleration.z / 9.81f;
    float totalAcc = sqrt(ax * ax + ay * ay + az * az);

    unsigned long now = millis();

    switch (fallState) {
        case NORMAL:
            // Estágio 1: Queda livre detectada (baixa aceleração súbita)
            if (totalAcc < FREE_FALL_THRESHOLD) {
                fallState = FREE_FALL_DETECTED;
                freeFallStartTime = now;
                Serial.printf("[FALL] Possível queda livre: acc=%.2fg\n", totalAcc);
            }
            break;

        case FREE_FALL_DETECTED:
            // Estágio 2: Impacto contra o solo (alta aceleração)
            if (totalAcc > IMPACT_THRESHOLD) {
                fallState = IMPACT_DETECTED;
                impactStartTime = now;
                Serial.printf("[FALL] Impacto detectado: acc=%.2fg!\n", totalAcc);
            } else if (now - freeFallStartTime > FALL_TIME_WINDOW_MS) {
                // Falso positivo (tempo esgotado sem impacto)
                fallState = NORMAL;
            }
            break;

        case IMPACT_DETECTED:
            // Estágio 3: Confirmação após pequeno período de repouso (1 segundo)
            if (now - impactStartTime > 1000) {
                currentStatus.fallDetected = true;
                fallState = NORMAL;
                Serial.println("[FALL] QUEDA CONFIRMADA! Disparando alerta de emergência!");
            }
            break;
    }
}

// ==========================================================
// Leitura de GPS NEO-6M
// ==========================================================
void processGpsData() {
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }

    if (gps.location.isUpdated() && gps.location.isValid()) {
        currentStatus.latitude = gps.location.lat();
        currentStatus.longitude = gps.location.lng();
        currentStatus.speedKmh = gps.speed.kmph();
        currentStatus.satellites = gps.satellites.value();
    }
}

// ==========================================================
// Leitura da Bateria (Divisor de Tensão)
// ==========================================================
float readBatteryLevel() {
    int raw = analogRead(PIN_BATTERY_ADC);
    // Conversão do ADC de 12 bits (0-4095) com divisor 2:1
    float voltage = (raw / 4095.0f) * 3.3f * 2.0f;
    // Mapeamento de 3.2V (0%) a 4.2V (100% LiPo)
    float percent = ((voltage - 3.2f) / (4.2f - 3.2f)) * 100.0f;
    if (percent > 100.0f) percent = 100.0f;
    if (percent < 0.0f) percent = 0.0f;
    return percent;
}

// ==========================================================
// Envio de Alertas HTTP para Backend Spring Boot
// ==========================================================
void sendAlertHttp(const char* alertType, const char* message, const char* severity) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[HTTP] Wi-Fi desconectado. Impossível enviar alerta direto.");
        return;
    }

    HTTPClient http;
    http.begin(ALERT_ENDPOINT);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["alertType"] = alertType;
    doc["severity"] = severity;
    doc["message"] = message;
    doc["latitude"] = currentStatus.latitude;
    doc["longitude"] = currentStatus.longitude;
    doc["batteryLevel"] = currentStatus.batteryPercent;
    doc["timestamp"] = millis();

    String requestBody;
    serializeJson(doc, requestBody);

    Serial.printf("[HTTP] Enviando Alerta (%s)... ", alertType);
    int httpResponseCode = http.POST(requestBody);
    Serial.printf("Resposta: %d\n", httpResponseCode);

    http.end();
}

// ==========================================================
// Envio de Telemetria HTTP para Backend
// ==========================================================
void sendTelemetryHttp() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(TELEMETRY_ENDPOINT);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["latitude"] = currentStatus.latitude;
    doc["longitude"] = currentStatus.longitude;
    doc["speedKmh"] = currentStatus.speedKmh;
    doc["satellites"] = currentStatus.satellites;
    doc["obstacleDistanceCm"] = currentStatus.distanceCm;
    doc["obstacleDetected"] = currentStatus.obstacleWarning;
    doc["batteryPercent"] = currentStatus.batteryPercent;
    doc["fallDetected"] = currentStatus.fallDetected;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = http.POST(requestBody);
    if (httpCode > 0) {
        Serial.printf("[HTTP] Telemetria enviada com sucesso (Cod: %d)\n", httpCode);
    } else {
        Serial.printf("[HTTP] Falha no envio de telemetria: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
}

// ==========================================================
// Transmissão de Dados via BLE (para o App Mobile)
// ==========================================================
void notifyBleClients() {
    if (!bleConnected || pCharacteristic == nullptr) return;

    JsonDocument doc;
    doc["dev"] = DEVICE_ID;
    doc["dist"] = (int)currentStatus.distanceCm;
    doc["lat"] = currentStatus.latitude;
    doc["lng"] = currentStatus.longitude;
    doc["bat"] = (int)currentStatus.batteryPercent;
    doc["sos"] = sosTriggered;
    doc["fall"] = currentStatus.fallDetected;

    String jsonString;
    serializeJson(doc, jsonString);

    pCharacteristic->setValue(jsonString.c_str());
    pCharacteristic->notify();
}

// ==========================================================
// Inicialização do BLE
// ==========================================================
void initBle() {
    BLEDevice::init(BLE_DEVICE_NAME);
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

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

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    Serial.println("[BLE] Servidor BLE pronto e aguardando conexões.");
}

// ==========================================================
// Configuração Inicial (SETUP)
// ==========================================================
void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n========================================");
    Serial.println("  Assistência de Mobilidade ESP32 v1.0  ");
    Serial.println("========================================");

    // Configuração dos Pinos
    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    pinMode(PIN_VIBRATION, OUTPUT);
    pinMode(PIN_SOS_BUTTON, INPUT_PULLUP);
    pinMode(PIN_BATTERY_ADC, INPUT);

    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_VIBRATION, LOW);

    // Interrupção do Botão SOS
    attachInterrupt(digitalPinToInterrupt(PIN_SOS_BUTTON), handleSosInterrupt, FALLING);

    // Inicialização do GPS (Serial 2)
    gpsSerial.begin(GPS_BAUD_RATE, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
    Serial.println("[GPS] Módulo NEO-6M inicializado na Serial2.");

    // Inicialização I2C e MPU-6050
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (mpu.begin()) {
        mpuAvailable = true;
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
        Serial.println("[MPU] Sensor MPU-6050 calibrado com sucesso.");
    } else {
        Serial.println("[AVISO] Falha ao encontrar MPU-6050. Verifique conexões I2C.");
    }

    // Inicialização BLE
    initBle();

    // Conexão Wi-Fi
    Serial.printf("[WIFI] Conectando a %s...", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WIFI] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WIFI] Não conectado no boot. O dispositivo operará via BLE.");
    }

    // Bipe sonoro de inicialização concluída
    digitalWrite(PIN_BUZZER, HIGH);
    delay(150);
    digitalWrite(PIN_BUZZER, LOW);
}

// ==========================================================
// Loop Principal (EXECUÇÃO)
// ==========================================================
void loop() {
    unsigned long now = millis();

    // 1. Processar GPS contínuo
    processGpsData();

    // 2. Leitura rápida dos Sensores de Detecção e Segurança (100ms)
    if (now - lastSensorReadTime >= SENSOR_READ_INTERVAL_MS) {
        lastSensorReadTime = now;

        // Ultrassom
        currentStatus.distanceCm = readUltrasonicDistance();
        processObstacleFeedback(currentStatus.distanceCm);

        // IMU / Detecção de Queda
        processFallDetection();

        // Bateria
        currentStatus.batteryPercent = readBatteryLevel();

        // Notificar App via BLE se conectado
        notifyBleClients();
    }

    // 3. Tratamento Prioritário: Botão SOS Pressionado
    if (sosTriggered) {
        Serial.println("\n🚨 [EMERGÊNCIA] BOTÃO SOS ACIONADO!");
        
        // Alerta sonoro de emergência
        for (int i = 0; i < 3; i++) {
            digitalWrite(PIN_BUZZER, HIGH);
            digitalWrite(PIN_VIBRATION, HIGH);
            delay(100);
            digitalWrite(PIN_BUZZER, LOW);
            digitalWrite(PIN_VIBRATION, LOW);
            delay(100);
        }

        sendAlertHttp("SOS_BUTTON", "Botão SOS pressionado pelo usuário!", "CRITICAL");
        notifyBleClients();
        sosTriggered = false;
    }

    // 4. Tratamento Prioritário: Queda Confirmada
    if (currentStatus.fallDetected) {
        Serial.println("\n🚨 [EMERGÊNCIA] QUEDA DETECTADA PELO MPU-6050!");
        sendAlertHttp("FALL_DETECTED", "Queda brusca detectada pelos sensores!", "CRITICAL");
        notifyBleClients();
        currentStatus.fallDetected = false;
    }

    // 5. Envio Periódico de Telemetria (5s)
    if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = now;
        sendTelemetryHttp();
    }
}
