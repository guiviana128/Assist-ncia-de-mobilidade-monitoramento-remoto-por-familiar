package com.assistmob.family;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FamilySessions extends JpaRepository<FamilySession, String> {
  void deleteByEmail(String email);

  void deleteByExpiresAtBefore(java.time.Instant now);
}
