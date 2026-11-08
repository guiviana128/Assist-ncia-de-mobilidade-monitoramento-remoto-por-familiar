package com.assistmob.family;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "amparo_accounts")
@Getter
@Setter
@NoArgsConstructor
public class FamilyAccount {
  @Id private String email;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false)
  private String passwordHash;

  @Column(nullable = false)
  private String familyId;

  private String recoveryHash;
}
