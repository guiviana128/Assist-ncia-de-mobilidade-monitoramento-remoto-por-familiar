# 🔌 Diagrama de Fiação e Pinagem do Hardware (ESP32)

Este guia descreve as conexões elétricas entre o **ESP32 NodeMCU (30 pinos ou 38 pinos)** e todos os periféricos e sensores da bengala / dispositivo de assistência.

---

## 📌 Tabela Resumo de Pinagem

| Componente | Pino do Componente | Pino do ESP32 | Observação |
| :--- | :--- | :--- | :--- |
| **HC-SR04** (Ultrassom) | VCC | **VIN (5V)** | Alimentação recomendada 5V |
| | GND | **GND** | Terra comum |
| | TRIG | **GPIO 5** | Trigger do sinal ultrassônico |
| | ECHO | **GPIO 18** | Usar divisor resistivo (1k/2k) para 3.3V |
| **MPU-6050** (Acelerômetro) | VCC | **3V3** | Alimentação 3.3V |
| | GND | **GND** | Terra comum |
| | SDA | **GPIO 21** | Barramento I2C Dados |
| | SCL | **GPIO 22** | Barramento I2C Clock |
| **NEO-6M** (GPS) | VCC | **3V3** / 5V | Alimentação |
| | GND | **GND** | Terra comum |
| | TX | **GPIO 16** (RX2) | Transmite NMEA para o ESP32 |
| | RX | **GPIO 17** (TX2) | Recebe comandos (opcional) |
| **Botão SOS** | Terminal 1 | **GPIO 4** | Configurado com Pull-up interno |
| | Terminal 2 | **GND** | Fechamento ao pressionar |
| **Buzzer Ativo** | Ânodo (+) | **GPIO 19** | Ativação nível alto |
| | Cátodo (-) | **GND** | |
| **Motor Vibratório** | Positivo (+) | **GPIO 23** | Acionado via transistor NPN 2N2222 |
| | Negativo (-) | **GND** | |
| **Divisor Bateria (LiPo)** | Bateria (+) -> R1(10k) | **GPIO 34** (ADC) | R2(10k) ligado ao GND (fator 1/2) |

---

## 💡 Dicas de Montagem & Cuidados

1. **Divisor de Tensão no Pino ECHO do HC-SR04**:
   - O HC-SR04 opera em 5V e o pino ECHO emite sinal de 5V. O ESP32 suporta 3.3V em suas GPIOs.
   - Coloque um resistor de **1kΩ** entre o ECHO e a GPIO 18, e um resistor de **2kΩ** da GPIO 18 para o GND.
2. **Motor de Vibração**:
   - Não ligue o motor diretamente à GPIO do ESP32 (evitar sobrecorrente). Utilize um transistor NPN (como 2N2222 ou BC547) ou módulo Driver MOSFET com diodo de proteção contra flyback (1N4007).
3. **Antena do GPS**:
   - A antena cerâmica do NEO-6M precisa estar voltada para o céu para conseguir o *fix* dos satélites (LED indicador do GPS piscando).
