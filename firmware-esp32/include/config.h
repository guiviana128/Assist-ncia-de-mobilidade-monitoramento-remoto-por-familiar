#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// Identificação do Dispositivo
// ==========================================
#define DEVICE_ID "ESP32-MOB-001"
#define DEVICE_MAC "AA:BB:CC:DD:EE:01"
#define FIRMWARE_VERSION "2.0.0-PRO"

// ==========================================
// Configurações de Rede Wi-Fi & Servidor
// ==========================================
#define WIFI_SSID "SUA_REDE_WIFI"
#define WIFI_PASSWORD "SUA_SENHA_WIFI"

#define SERVER_BASE_URL "http://192.168.1.100:8080/api/v1"
#define TELEMETRY_ENDPOINT SERVER_BASE_URL "/telemetry"
#define ALERT_ENDPOINT SERVER_BASE_URL "/alerts"
#define COMMAND_POLL_ENDPOINT SERVER_BASE_URL "/devices/" DEVICE_ID "/command"

// ==========================================
// Mapeamento de Pinos de Hardware (ESP32)
// ==========================================

// 1. Sensor Ultrassônico Frontal (Postes, Portas, Pessoas)
#define PIN_TRIG_FRONT 5
#define PIN_ECHO_FRONT 18

// 2. Sensor de Chão / Desnível (Buracos, Degraus, Meio-fio a 45°)
#define PIN_TRIG_GROUND 13
#define PIN_ECHO_GROUND 14

// 3. Botão Multifunção SOS / Check-in
#define PIN_BUTTON_SOS 4

// 4. Sensor de Toque Capacitivo na Manopla (Grip Touch)
#define PIN_TOUCH_GRIP 15 // Pino T3 do ESP32
#define TOUCH_THRESHOLD 40 // Limiar de detecção da mão segurando a bengala

// 5. Farol LED Noturno Automático + Sensor de Luz (LDR)
#define PIN_HEADLIGHT_LED 2
#define PIN_LDR_SENSOR 35 // ADC entrada analógica de luminosidade
#define LDR_DARK_THRESHOLD 1200 // Abaixo deste valor o ambiente está escuro

// 6. Feedback Tátil Diferenciado
#define PIN_HAPTIC_FINGERS 19 // Motor de vibração na ponta dos dedos (obstáculo frontal)
#define PIN_HAPTIC_PALM 23    // Motor de vibração na palma da mão (degraus e buracos)
#define PIN_BUZZER 25         // Buzzer piezoelétrico para bipes e localizador

// 7. Módulo GPS (NEO-6M via Hardware Serial 2)
#define PIN_GPS_RX 16
#define PIN_GPS_TX 17
#define GPS_BAUD_RATE 9600

// 8. I2C para MPU-6050 (Acelerômetro + Giroscópio)
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22

// 9. Medição de Bateria (Divisor Resistivo 10k/10k)
#define PIN_BATTERY_ADC 34

// ==========================================
// Parâmetros dos Algoritmos de Proteção
// ==========================================

// Obstáculos Frontais (HC-SR04 Frontal)
#define OBSTACLE_WARN_DIST_CM 110.0f
#define OBSTACLE_CRITICAL_DIST_CM 40.0f

// Degraus e Buracos no Chão (Sensor 45°)
#define GROUND_NORMAL_DIST_CM 65.0f   // Distância normal ao solo
#define GROUND_POTHOLE_DIFF_CM 35.0f  // Aumento >35cm indica buraco ou descida de degrau

// Detecção de Queda em 3 Estágios com Filtro de Pegada
#define FREE_FALL_THRESHOLD 0.38f     // Aceleração < 0.38g (Queda livre)
#define IMPACT_THRESHOLD 2.7f         // Aceleração > 2.7g (Impacto contra o solo)
#define FALL_WINDOW_MS 650

// Filtro de Bengala Apoiada na Parede (Anti-Falsos Positivos)
#define LEANING_ANGLE_MIN 65.0f
#define LEANING_ANGLE_MAX 82.0f
#define LEANING_TIME_CONFIRM_MS 4000

// Detecção de Marcha e Tremores (Parkinson / Cadência)
#define STEP_ACCEL_THRESHOLD 1.25f
#define TREMOR_FREQ_MIN 3.0f
#define TREMOR_FREQ_MAX 7.0f

// ==========================================
// BLE (Bluetooth Low Energy)
// ==========================================
#define BLE_DEVICE_NAME "AssistMob-ProStick"
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

#endif // CONFIG_H
