package com.assistmob.family;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "amparo_invites")
@Getter
@Setter
@NoArgsConstructor
public class FamilyInvite {
  @Id private String tokenHash;
  private String familyId;
  private Instant expiresAt;
  @Version private Long version;
}
