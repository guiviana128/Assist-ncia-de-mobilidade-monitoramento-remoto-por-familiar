package com.assistmob.monitoring;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "amparo_ai_reports")
@Getter
@Setter
@NoArgsConstructor
public class AiReport {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String deviceId;
  private Instant createdAt;
  private String state;
  private String model;

  @Column(length = 12000)
  private String summary;
}
