package com.assistmob.family;

import com.assistmob.model.User;
import com.assistmob.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/care/notifications")
public class NotificationController {
  private final FamilyAccess access;
  private final FamilyAccounts accounts;
  private final UserRepository users;

  public NotificationController(FamilyAccess a, FamilyAccounts ac, UserRepository u) {
    access = a;
    accounts = ac;
    users = u;
  }

  public record Token(@Size(max = 2048) String token) {}

  @PostMapping("/token")
  public Object token(@Valid @RequestBody Token body) {
    access.family();
    var account = accounts.findById(access.actor()).orElseThrow();
    var user =
        users
            .findByEmail(account.getEmail())
            .orElseGet(
                () ->
                    User.builder()
                        .email(account.getEmail())
                        .name(account.getName())
                        .role("GUARDIAN")
                        .build());
    user.setFcmToken(body.token());
    users.save(user);
    return Map.of("registered", body.token() != null && !body.token().isBlank());
  }
}
