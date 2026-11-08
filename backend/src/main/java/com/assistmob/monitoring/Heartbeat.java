package com.assistmob.monitoring;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "amparo_heartbeats")
@Getter
@Setter
@NoArgsConstructor
public class Heartbeat {
  @Id private String id;
  private String deviceId;
  private String component;
  private Instant receivedAt;
  private String state;
}
