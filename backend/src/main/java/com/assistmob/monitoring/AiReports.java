package com.assistmob.monitoring;

import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiReports extends JpaRepository<AiReport, Long> {
  List<AiReport> findByDeviceIdOrderByCreatedAtDesc(String deviceId, Pageable p);

  Optional<AiReport> findFirstByDeviceIdOrderByCreatedAtDesc(String deviceId);
}
