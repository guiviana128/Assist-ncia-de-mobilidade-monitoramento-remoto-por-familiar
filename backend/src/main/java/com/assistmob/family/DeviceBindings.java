package com.assistmob.family;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceBindings extends JpaRepository<DeviceBinding, String> {
  List<DeviceBinding> findByFamilyId(String familyId);

  Optional<DeviceBinding> findByRobotId(String robotId);

  Optional<DeviceBinding> findByKeyHash(String keyHash);

  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query(
      "select b from DeviceBinding b where b.deviceId = :deviceId")
  Optional<DeviceBinding> lockDevice(
      @org.springframework.data.repository.query.Param("deviceId") String deviceId);
}
