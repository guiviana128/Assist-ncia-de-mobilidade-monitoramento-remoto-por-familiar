package com.assistmob.family;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "amparo_sessions")
@Getter
@Setter
@NoArgsConstructor
public class FamilySession {
  @Id private String tokenHash;

  @Column(nullable = false)
  private String email;

  @Column(nullable = false)
  private Instant expiresAt;
}
