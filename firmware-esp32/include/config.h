#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// Identificação do Dispositivo
// ==========================================
#define DEVICE_ID "ESP32-MOB-001"
#define DEVICE_MAC "AA:BB:CC:DD:EE:01"
#define FIRMWARE_VERSION "1.0.0"

// ==========================================
// Configurações de Rede Wi-Fi
// ==========================================
#define WIFI_SSID "SUA_REDE_WIFI"
#define WIFI_PASSWORD "SUA_SENHA_WIFI"

// Endpoint da API Spring Boot
// Para teste local via emulador ou na mesma rede, use o IP da sua máquina na LAN (ex: 192.168.1.100)
#define SERVER_BASE_URL "http://192.168.1.100:8080/api/v1"
#define TELEMETRY_ENDPOINT SERVER_BASE_URL "/telemetry"
#define ALERT_ENDPOINT SERVER_BASE_URL "/alerts"

// ==========================================
// Mapeamento de Pinos de Hardware (ESP32)
// ==========================================

// Sensor Ultrassônico HC-SR04
#define PIN_TRIG 5
#define PIN_ECHO 18

// Botão de Pânico / SOS (com interrupção externa)
#define PIN_SOS_BUTTON 4

// Feedback Sonoro e Vibratório
#define PIN_BUZZER 19
#define PIN_VIBRATION 23

// Módulo GPS (NEO-6M via Hardware Serial 2)
#define PIN_GPS_RX 16 // Conectado ao TX do NEO-6M
#define PIN_GPS_TX 17 // Conectado ao RX do NEO-6M
#define GPS_BAUD_RATE 9600

// I2C para MPU-6050 (Padrão ESP32: SDA=21, SCL=22)
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22

// Medição de Bateria (Divisor de tensão ADC)
#define PIN_BATTERY_ADC 34

// ==========================================
// Parâmetros e Limiares dos Algoritmos
// ==========================================

// Obstáculos (HC-SR04)
#define OBSTACLE_WARN_DIST_CM 100.0f   // Alerta moderado (< 1 metro)
#define OBSTACLE_CRITICAL_DIST_CM 40.0f // Alerta crítico (< 40 cm)

// Detecção de Queda (MPU-6050)
// 1. Queda livre (Aceleração total < FREE_FALL_THRESHOLD g)
#define FREE_FALL_THRESHOLD 0.4f
// 2. Impacto brusco (Aceleração total > IMPACT_THRESHOLD g)
#define IMPACT_THRESHOLD 2.8f
// 3. Intervalo máximo entre queda livre e impacto (ms)
#define FALL_TIME_WINDOW_MS 600

// Intervalos de Leitura e Envio
#define TELEMETRY_INTERVAL_MS 5000 // A cada 5s envia status e GPS normal
#define SENSOR_READ_INTERVAL_MS 100 // A cada 100ms processa IMU e Ultrassom

// ==========================================
// Configurações BLE (Bluetooth Low Energy)
// ==========================================
#define BLE_DEVICE_NAME "AssistMob-Stick"
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

#endif // CONFIG_H
