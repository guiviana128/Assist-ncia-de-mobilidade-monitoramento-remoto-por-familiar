package com.assistmob.repository;

import com.assistmob.model.AgentAction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgentActionRepository extends JpaRepository<AgentAction, Long> {
    List<AgentAction> findByDeviceIdOrderByRequestedAtDesc(String deviceId, Pageable pageable);
}
