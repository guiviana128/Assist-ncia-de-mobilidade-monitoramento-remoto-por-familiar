package com.assistmob.repository;

import com.assistmob.model.Alert;
import com.assistmob.model.enums.AlertStatus;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
  boolean existsByDeviceIdAndStatusNotAndAlertTypeIn(
      String deviceId,
      AlertStatus status,
      java.util.Collection<com.assistmob.model.enums.AlertType> types);

  List<Alert> findByDeviceIdOrderByCreatedAtDesc(String deviceId, Pageable pageable);

  List<Alert> findByStatusOrderByCreatedAtDesc(AlertStatus status);

  long countByStatus(AlertStatus status);
}
