package com.assistmob.family;

import com.assistmob.model.Device;
import com.assistmob.model.User;
import com.assistmob.repository.*;
import com.assistmob.security.TokenService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountService {
  private final FamilyAccounts accounts;
  private final DeviceBindings bindings;
  private final DeviceRepository devices;
  private final UserRepository users;
  private final TokenService tokens;
  private final FamilyInvites invites;
  private final FamilySessions sessions;

  public AccountService(
      FamilyAccounts a,
      DeviceBindings b,
      DeviceRepository d,
      UserRepository u,
      TokenService t,
      FamilyInvites i,
      FamilySessions s) {
    accounts = a;
    bindings = b;
    devices = d;
    users = u;
    tokens = t;
    invites = i;
    sessions = s;
  }

  @Transactional
  public Map<String, Object> register(
      String name, String email, String password, String personName, String invite) {
    String normalized = email.trim().toLowerCase(Locale.ROOT);
    String person =
        personName == null || personName.isBlank() ? "Pessoa acompanhada" : personName.trim();
    if (accounts.existsById(normalized))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Já existe uma conta com este e-mail.");
    String family = UUID.randomUUID().toString();
    if (invite != null && !invite.isBlank()) {
      var i =
          invites
              .findById(Secrets.digest(invite))
              .filter(x -> x.getExpiresAt().isAfter(java.time.Instant.now()))
              .orElseThrow(() -> new IllegalArgumentException("Convite inválido ou expirado"));
      family = i.getFamilyId();
      invites.delete(i);
    }
    String recovery = Secrets.token();
    var a = new FamilyAccount();
    a.setEmail(normalized);
    a.setName(name.trim());
    a.setFamilyId(family);
    a.setPasswordHash(Secrets.password(password));
    a.setRecoveryHash(Secrets.digest(recovery));
    accounts.save(a);
    if (invite != null && !invite.isBlank())
      return Map.of(
          "token",
          tokens.issueToken(normalized),
          "username",
          normalized,
          "recoveryCode",
          recovery,
          "deviceId",
          bindings.findByFamilyId(family).get(0).getDeviceId(),
          "robotId",
          bindings.findByFamilyId(family).get(0).getRobotId(),
          "deviceKey",
          "");
    User guardian =
        users
            .findByEmail(normalized)
            .orElseGet(
                () ->
                    users.save(
                        User.builder()
                            .name(name.trim())
                            .email(normalized)
                            .role("GUARDIAN")
                            .build()));
    String id = "AMP-" + UUID.randomUUID().toString().substring(0, 12), key = Secrets.token();
    var b = new DeviceBinding();
    b.setDeviceId(id);
    b.setRobotId("BOT-" + UUID.randomUUID().toString().substring(0, 12));
    b.setFamilyId(family);
    b.setKeyHash(Secrets.digest(key));
    b.setPersonName(person);
    bindings.save(b);
    devices.save(
        Device.builder()
            .deviceId(id)
            .name("Dispositivo Amparo (" + person + ")")
            .guardian(guardian)
            .isOnline(false)
            .build());
    return Map.of(
        "token",
        tokens.issueToken(normalized),
        "username",
        normalized,
        "expiresInSeconds",
        tokens.ttlSeconds(),
        "deviceId",
        id,
        "robotId",
        b.getRobotId(),
        "deviceKey",
        key,
        "recoveryCode",
        recovery);
  }

  @Transactional
  public String invite(String family) {
    String raw = Secrets.token();
    var i = new FamilyInvite();
    i.setTokenHash(Secrets.digest(raw));
    i.setFamilyId(family);
    i.setExpiresAt(java.time.Instant.now().plusSeconds(86400));
    invites.save(i);
    return raw;
  }

  /** Gera outro código de recuperação para a conta logada; o anterior deixa de valer. */
  @Transactional
  public String rotateRecovery(String email) {
    var a = accounts.findById(email).orElseThrow(FamilyAccess::denied);
    String next = Secrets.token();
    a.setRecoveryHash(Secrets.digest(next));
    accounts.save(a);
    return next;
  }

  @Transactional
  public String reset(String email, String recovery, String password) {
    var a =
        accounts
            .findById(email.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(() -> new IllegalArgumentException("Dados de recuperação inválidos"));
    if (a.getRecoveryHash() == null
        || !java.security.MessageDigest.isEqual(
            a.getRecoveryHash().getBytes(java.nio.charset.StandardCharsets.UTF_8),
            Secrets.digest(recovery).getBytes(java.nio.charset.StandardCharsets.UTF_8)))
      throw new IllegalArgumentException("Dados de recuperação inválidos");
    String next = Secrets.token();
    a.setRecoveryHash(Secrets.digest(next));
    a.setPasswordHash(Secrets.password(password));
    accounts.save(a);
    sessions.deleteByEmail(a.getEmail());
    return next;
  }
}
