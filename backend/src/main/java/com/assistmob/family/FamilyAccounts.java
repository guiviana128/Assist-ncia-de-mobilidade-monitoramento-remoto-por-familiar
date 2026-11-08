package com.assistmob.family;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FamilyAccounts extends JpaRepository<FamilyAccount, String> {
  java.util.List<FamilyAccount> findByFamilyId(String familyId);
}
