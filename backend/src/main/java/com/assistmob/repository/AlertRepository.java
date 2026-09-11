package com.assistmob.repository;

import com.assistmob.model.Alert;
import com.assistmob.model.enums.AlertStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByDeviceIdOrderByCreatedAtDesc(String deviceId, Pageable pageable);
    List<Alert> findByStatusOrderByCreatedAtDesc(AlertStatus status);
    long countByStatus(AlertStatus status);
}
