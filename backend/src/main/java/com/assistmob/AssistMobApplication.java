package com.assistmob;

import com.assistmob.model.Device;
import com.assistmob.model.User;
import com.assistmob.repository.DeviceRepository;
import com.assistmob.repository.UserRepository;
import java.time.LocalDateTime;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@org.springframework.scheduling.annotation.EnableScheduling
@SpringBootApplication
public class AssistMobApplication {
  static {
    com.assistmob.config.LocalDatabasePath.register();
  }

  public static void main(String[] args) {
    SpringApplication.run(AssistMobApplication.class, args);
  }

  // Cria dados iniciais de demonstração (Dispositivo ESP32 e Usuário Cuidador)
  @Bean
  @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
      name = "assistmob.demo.seed",
      havingValue = "true")
  CommandLineRunner initDatabase(UserRepository userRepository, DeviceRepository deviceRepository) {
    return args -> {
      if (userRepository.count() == 0) {
        User guardian =
            User.builder()
                .name("Maria Silva (Filha / Familiar)")
                .email("maria.silva@exemplo.com")
                .phone("+55 11 98765-4321")
                .role("GUARDIAN")
                .fcmToken("fcm_demo_token_123456")
                .build();

        User patient =
            User.builder()
                .name("José Silva (Idoso / Usuário)")
                .email("jose.silva@exemplo.com")
                .phone("+55 11 91234-5678")
                .role("PATIENT")
                .build();

        userRepository.save(guardian);
        userRepository.save(patient);

        Device device =
            Device.builder()
                .deviceId("ESP32-MOB-001")
                .name("Bengala Inteligente AssistMob")
                .macAddress("AA:BB:CC:DD:EE:01")
                .firmwareVersion("1.0.0")
                .isOnline(true)
                .lastLatitude(-23.550520)
                .lastLongitude(-46.633308)
                .lastBatteryPercent(92.0f)
                .lastPingAt(LocalDateTime.now())
                .guardian(guardian)
                .patient(patient)
                .build();

        deviceRepository.save(device);
        System.out.println("✅ [SEED] Dados iniciais do AssistMob carregados com sucesso!");
      }
    };
  }
}
