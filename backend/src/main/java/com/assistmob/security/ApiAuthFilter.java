package com.assistmob.security;

import com.assistmob.security.AuthPrincipal.Role;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Autenticação e autorização de toda a API (correção V-01 do pentest).
 *
 * - Dispositivos (bengala, robô) enviam o cabeçalho X-API-Key e só acessam as rotas de dispositivo.
 * - Familiares fazem login (POST /api/v1/auth/login) e enviam Authorization: Bearer <token>.
 *   Não podem se passar pelo robô (rotas de estado/missão do robô são exclusivas de dispositivo).
 */
public class ApiAuthFilter extends OncePerRequestFilter {

    private record Route(HttpMethod method, String pattern) {
    }

    /** Rotas que só o robô/bengala pode chamar. */
    private static final List<Route> DEVICE_ONLY = List.of(
            new Route(HttpMethod.POST, "/api/v1/robot/*/state"),
            new Route(HttpMethod.POST, "/api/v1/robot/*/missions/claim"),
            new Route(HttpMethod.POST, "/api/v1/robot/*/missions/*/complete")
    );

    /** Demais rotas liberadas para dispositivos. */
    private static final List<Route> DEVICE_ALLOWED = List.of(
            new Route(HttpMethod.POST, "/api/v1/telemetry"),
            new Route(HttpMethod.POST, "/api/v1/alerts"),
            new Route(HttpMethod.GET, "/api/v1/alerts/recent/*"),
            new Route(HttpMethod.POST, "/api/v1/vision/events"),
            new Route(HttpMethod.GET, "/api/v1/house/layout")
    );

    private static final List<String> PUBLIC = List.of("/api/v1/auth/login");

    private final AntPathMatcher matcher = new AntPathMatcher();
    private final SecurityProperties properties;
    private final TokenService tokenService;

    public ApiAuthFilter(SecurityProperties properties, TokenService tokenService) {
        this.properties = properties;
        this.tokenService = tokenService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = path(request);
        return !properties.isEnabled()
                || HttpMethod.OPTIONS.matches(request.getMethod())
                || !path.startsWith("/api/")
                || PUBLIC.contains(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<AuthPrincipal> principal = authenticate(request);
        if (principal.isEmpty()) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "unauthorized",
                    "Faça login (familiar) ou envie a chave X-API-Key (dispositivo).");
            return;
        }

        if (!isAllowed(principal.get().role(), request.getMethod(), path(request))) {
            reject(response, HttpServletResponse.SC_FORBIDDEN, "forbidden",
                    "Este perfil não tem permissão para esta operação.");
            return;
        }

        request.setAttribute(AuthPrincipal.REQUEST_ATTRIBUTE, principal.get());
        chain.doFilter(request, response);
    }

    private Optional<AuthPrincipal> authenticate(HttpServletRequest request) {
        String apiKey = request.getHeader("X-API-Key");
        if (apiKey != null && TokenService.constantTimeEquals(apiKey, properties.getDeviceApiKey())) {
            return Optional.of(new AuthPrincipal(Role.DEVICE, "dispositivo"));
        }

        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return tokenService.validate(authorization.substring(7).trim())
                    .map(username -> new AuthPrincipal(Role.FAMILY, username));
        }
        return Optional.empty();
    }

    boolean isAllowed(Role role, String method, String path) {
        boolean deviceOnly = matches(DEVICE_ONLY, method, path);
        if (role == Role.DEVICE) {
            return deviceOnly || matches(DEVICE_ALLOWED, method, path);
        }
        return !deviceOnly;
    }

    private boolean matches(List<Route> routes, String method, String path) {
        return routes.stream().anyMatch(r -> r.method().matches(method) && matcher.match(r.pattern(), path));
    }

    private static String path(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String context = request.getContextPath();
        return context != null && !context.isEmpty() && uri.startsWith(context) ? uri.substring(context.length()) : uri;
    }

    private static void reject(HttpServletResponse response, int status, String error, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"" + error + "\",\"message\":\"" + message + "\"}");
    }
}
