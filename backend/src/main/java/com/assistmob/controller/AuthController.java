package com.assistmob.controller;

import com.assistmob.security.AuthPrincipal;
import com.assistmob.security.LoginRateLimiter;
import com.assistmob.security.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

  public record LoginRequest(
      @NotBlank @Size(max = 120) String username, @NotBlank @Size(max = 120) String password) {}

  private final TokenService tokenService;
  private final LoginRateLimiter rateLimiter;
  private final com.assistmob.family.AccountService accounts;

  public record RegisterRequest(
      @NotBlank @Size(max = 100) String name,
      @jakarta.validation.constraints.Email @NotBlank @Size(max = 120) String email,
      @NotBlank @Size(min = 12, max = 120) String password,
      // Opcional: no cadastro em 8 passos o nome de quem é acompanhado vem no passo 2.
      @Size(max = 100) String personName,
      @Size(max = 100) String invite) {}

  @PostMapping("/register")
  public ResponseEntity<Map<String, Object>> register(
      @Valid @RequestBody RegisterRequest body, HttpServletRequest request) {
    String ip = request.getRemoteAddr();
    if (rateLimiter.isBlocked("register:" + ip))
      throw new org.springframework.web.server.ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS);
    try {
      var created = accounts.register(
          body.name(), body.email(), body.password(), body.personName(), body.invite());
      rateLimiter.reset("register:" + ip);
      return ResponseEntity.status(HttpStatus.CREATED).body(created);
    } catch (IllegalArgumentException | org.springframework.web.server.ResponseStatusException rejected) {
      rateLimiter.recordFailure("register:" + ip);
      throw rejected;
    }
  }

  @PostMapping("/login")
  public ResponseEntity<Map<String, Object>> login(
      @Valid @RequestBody LoginRequest body, HttpServletRequest request) {
    String ip = request.getRemoteAddr();
    if (rateLimiter.isBlocked(ip)) {
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
          .body(
              Map.of(
                  "error", "too_many_attempts",
                  "message", "Muitas tentativas. Aguarde 5 minutos."));
    }
    if (!tokenService.checkFamilyCredentials(body.username(), body.password())) {
      rateLimiter.recordFailure(ip);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(
              Map.of(
                  "error", "invalid_credentials",
                  "message", "Usuário ou senha incorretos."));
    }
    rateLimiter.reset(ip);
    return ResponseEntity.ok(
        Map.of(
            "token", tokenService.issueToken(body.username()),
            "username", body.username(),
            "expiresInSeconds", tokenService.ttlSeconds()));
  }

  public record ResetRequest(
      @NotBlank String email,
      @NotBlank @Size(max = 100) String recoveryCode,
      @NotBlank @Size(min = 12, max = 120) String password) {}

  @PostMapping("/reset")
  public Object reset(@Valid @RequestBody ResetRequest body, HttpServletRequest req) {
    String bucket = "reset:" + req.getRemoteAddr();
    if (rateLimiter.isBlocked(bucket))
      throw new org.springframework.web.server.ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS);
    rateLimiter.recordFailure(bucket);
    return Map.of(
        "recoveryCode", accounts.reset(body.email(), body.recoveryCode(), body.password()));
  }

  @GetMapping("/me")
  public ResponseEntity<Map<String, String>> me(HttpServletRequest request) {
    Object principal = request.getAttribute(AuthPrincipal.REQUEST_ATTRIBUTE);
    if (principal instanceof AuthPrincipal p) {
      return ResponseEntity.ok(Map.of("username", p.name(), "role", p.role().name()));
    }
    return ResponseEntity.ok(Map.of("username", "anonimo", "role", "SECURITY_DISABLED"));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    if (authorization != null && authorization.startsWith("Bearer ")) {
      tokenService.revoke(authorization.substring(7).trim());
    }
    return ResponseEntity.noContent().build();
  }
}
