package com.assistmob.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;

public interface Heartbeats extends JpaRepository<Heartbeat, String> {}
