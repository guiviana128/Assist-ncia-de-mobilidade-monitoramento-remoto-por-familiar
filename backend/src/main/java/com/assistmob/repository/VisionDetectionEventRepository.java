package com.assistmob.repository;

import com.assistmob.model.VisionDetectionEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VisionDetectionEventRepository extends JpaRepository<VisionDetectionEvent, Long> {
    Optional<VisionDetectionEvent> findByEventId(String eventId);
}
