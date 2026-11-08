package com.assistmob.family;

import com.assistmob.security.AuthPrincipal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.*;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FamilyAccess {
  private final FamilyAccounts accounts;
  private final DeviceBindings bindings;

  public FamilyAccess(FamilyAccounts accounts, DeviceBindings bindings) {
    this.accounts = accounts;
    this.bindings = bindings;
  }

  public AuthPrincipal principal() {
    var attrs = RequestContextHolder.getRequestAttributes();
    if (!(attrs instanceof ServletRequestAttributes a)) return null;
    return (AuthPrincipal) a.getRequest().getAttribute(AuthPrincipal.REQUEST_ATTRIBUTE);
  }

  public String actor() {
    var p = principal();
    if (p == null) throw denied();
    return p.name();
  }

  public String family() {
    var p = principal();
    if (p == null || p.role() != AuthPrincipal.Role.FAMILY) throw denied();
    return accounts.findById(p.name()).orElseThrow(FamilyAccess::denied).getFamilyId();
  }

  public List<DeviceBinding> devices() {
    return bindings.findByFamilyId(family());
  }

  public boolean canRead(String id) {
    var p = principal();
    if (p == null) return false;
    if (p.role() == AuthPrincipal.Role.DEVICE) return id.equals(p.name());
    return bindings.findById(id).map(b -> b.getFamilyId().equals(family())).orElse(false);
  }

  public void device(String id) {
    if (!canRead(id)) throw denied();
  }

  public void robot(String id) {
    var b = bindings.findByRobotId(id).orElseThrow(FamilyAccess::denied);
    device(b.getDeviceId());
  }

  public String defaultRobot() {
    return devices().stream().findFirst().orElseThrow(FamilyAccess::denied).getRobotId();
  }

  public static ResponseStatusException denied() {
    return new ResponseStatusException(
        HttpStatus.FORBIDDEN, "Acesso não permitido para esta família.");
  }
}
