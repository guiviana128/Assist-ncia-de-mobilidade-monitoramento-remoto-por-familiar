package com.assistmob.security;

import com.assistmob.family.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class TokenService {
  private final FamilyAccounts accounts;
  private final FamilySessions sessions;
  private final SecurityProperties properties;

  public TokenService(
      FamilyAccounts accounts, FamilySessions sessions, SecurityProperties properties) {
    this.accounts = accounts;
    this.sessions = sessions;
    this.properties = properties;
  }

  public boolean checkFamilyCredentials(String username, String password) {
    if (username == null || password == null) return false;
    return accounts
        .findById(username.trim().toLowerCase(Locale.ROOT))
        .map(a -> Secrets.matches(password, a.getPasswordHash()))
        .orElse(false);
  }

  @org.springframework.transaction.annotation.Transactional
  public String issueToken(String username) {
    sessions.deleteByExpiresAtBefore(Instant.now());
    String raw = Secrets.token();
    var s = new FamilySession();
    s.setTokenHash(Secrets.digest(raw));
    s.setEmail(username.trim().toLowerCase(Locale.ROOT));
    s.setExpiresAt(Instant.now().plusSeconds(ttlSeconds()));
    sessions.save(s);
    return raw;
  }

  public Optional<String> validate(String token) {
    if (token == null || token.isBlank()) return Optional.empty();
    return sessions
        .findById(Secrets.digest(token))
        .filter(s -> s.getExpiresAt().isAfter(Instant.now()))
        .map(FamilySession::getEmail);
  }

  public void revoke(String token) {
    if (token != null) sessions.deleteById(Secrets.digest(token));
  }

  public long ttlSeconds() {
    return properties.getTokenTtlMinutes() * 60;
  }

  static boolean constantTimeEquals(String a, String b) {
    return a != null
        && b != null
        && java.security.MessageDigest.isEqual(
            Secrets.digest(a).getBytes(java.nio.charset.StandardCharsets.UTF_8),
            Secrets.digest(b).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
