package com.assistmob.security;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * Filtros HTTP: primeiro CORS (só as origens configuradas, correção V-04), depois autenticação.
 * Antes do pentest o CORS aceitava qualquer origem ("*") em todos os controllers.
 */
@Configuration
public class SecurityConfig {

  private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

  private final SecurityProperties properties;

  public SecurityConfig(SecurityProperties properties) {
    this.properties = properties;
  }

  @Bean
  public FilterRegistrationBean<CorsFilter> corsFilter() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(properties.getCorsOrigins());
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-API-Key"));
    config.setAllowCredentials(false);
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);

    FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter(source));
    bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return bean;
  }

  @Bean
  public FilterRegistrationBean<ApiAuthFilter> apiAuthFilter(
      TokenService tokenService, com.assistmob.family.DeviceBindings bindings) {
    FilterRegistrationBean<ApiAuthFilter> bean =
        new FilterRegistrationBean<>(new ApiAuthFilter(properties, tokenService, bindings));
    bean.addUrlPatterns("/api/*");
    bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
    return bean;
  }

  @EventListener(ApplicationReadyEvent.class)
  public void warnAboutConfiguration() {
    if (!properties.isEnabled()) {
      log.warn(
          "⚠️  SEGURANÇA DESLIGADA (ASSISTMOB_SECURITY_ENABLED=false). Use só para reproduzir o"
              + " pentest.");
    } else {
      log.info("Contas persistentes e credenciais individuais dos equipamentos habilitadas.");
    }
    log.info("CORS liberado apenas para: {}", properties.getCorsOrigins());
  }
}
