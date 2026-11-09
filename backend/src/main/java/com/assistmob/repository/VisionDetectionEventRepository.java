package com.assistmob.repository;

import com.assistmob.model.VisionDetectionEvent;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VisionDetectionEventRepository extends JpaRepository<VisionDetectionEvent, Long> {
  Optional<VisionDetectionEvent> findByEventId(String eventId);

  java.util.List<VisionDetectionEvent> findByDeviceIdOrderByReceivedAtDesc(
      String deviceId, org.springframework.data.domain.Pageable pageable);

  long countByDeviceId(String deviceId);
}
