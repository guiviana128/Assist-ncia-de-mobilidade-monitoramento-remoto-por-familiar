package com.assistmob.repository;

import com.assistmob.model.Telemetry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TelemetryRepository extends JpaRepository<Telemetry, Long> {
    
    Optional<Telemetry> findFirstByDeviceIdOrderByRecordedAtDesc(String deviceId);

    List<Telemetry> findByDeviceIdOrderByRecordedAtDesc(String deviceId, Pageable pageable);

    @Query("SELECT t FROM Telemetry t WHERE t.deviceId = :deviceId AND t.recordedAt >= :since ORDER BY t.recordedAt ASC")
    List<Telemetry> findRecentRoute(@Param("deviceId") String deviceId, @Param("since") LocalDateTime since);
}
