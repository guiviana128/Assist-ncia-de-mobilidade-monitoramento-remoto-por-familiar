package com.assistmob.family;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "amparo_care_preferences")
@Getter
@Setter
@NoArgsConstructor
public class CarePreferences {
  @Id private String familyId;

  @Column(length = 20000)
  private String settings;

  @Version private Long version;
}
