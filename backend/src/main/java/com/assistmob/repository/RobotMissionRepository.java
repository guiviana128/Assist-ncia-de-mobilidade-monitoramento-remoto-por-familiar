package com.assistmob.repository;

import com.assistmob.model.RobotMission;
import com.assistmob.model.enums.MissionStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RobotMissionRepository extends JpaRepository<RobotMission, Long> {

    List<RobotMission> findByRobotIdAndStatus(String robotId, MissionStatus status);

    List<RobotMission> findByRobotIdOrderByCreatedAtDesc(String robotId, Pageable pageable);

    Optional<RobotMission> findFirstByRobotIdAndStatusOrderByStartedAtDesc(String robotId, MissionStatus status);

    boolean existsByAlertId(Long alertId);
}
