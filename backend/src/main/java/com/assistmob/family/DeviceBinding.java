package com.assistmob.family;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "amparo_device_bindings")
@Getter
@Setter
@NoArgsConstructor
public class DeviceBinding {
  @Id private String deviceId;

  @Column(nullable = false)
  private String familyId;

  @Column(nullable = false, unique = true)
  private String robotId;

  @Column(nullable = false, unique = true)
  private String keyHash;

  private String personName;
}
