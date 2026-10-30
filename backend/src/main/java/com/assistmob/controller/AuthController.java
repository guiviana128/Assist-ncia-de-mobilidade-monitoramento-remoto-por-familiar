package com.assistmob.controller;

import com.assistmob.security.AuthPrincipal;
import com.assistmob.security.LoginRateLimiter;
import com.assistmob.security.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    public record LoginRequest(@NotBlank @Size(max = 60) String username, @NotBlank @Size(max = 120) String password) {
    }

    private final TokenService tokenService;
    private final LoginRateLimiter rateLimiter;

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (rateLimiter.isBlocked(ip)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", "too_many_attempts",
                    "message", "Muitas tentativas. Aguarde 5 minutos."));
        }
        if (!tokenService.checkFamilyCredentials(body.username(), body.password())) {
            rateLimiter.recordFailure(ip);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "invalid_credentials",
                    "message", "Usuário ou senha incorretos."));
        }
        rateLimiter.reset(ip);
        return ResponseEntity.ok(Map.of(
                "token", tokenService.issueToken(body.username()),
                "username", body.username(),
                "expiresInSeconds", tokenService.ttlSeconds()));
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
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            tokenService.revoke(authorization.substring(7).trim());
        }
        return ResponseEntity.noContent().build();
    }
}
