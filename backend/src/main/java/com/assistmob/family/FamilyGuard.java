package com.assistmob.family;

import com.assistmob.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.*;
import java.lang.reflect.Type;
import java.util.Map;
import org.springframework.core.MethodParameter;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;

@ControllerAdvice
public class FamilyGuard extends RequestBodyAdviceAdapter
    implements HandlerInterceptor, WebMvcConfigurer {
  private final FamilyAccess access;
  private final AlertRepository alerts;
  private final AgentActionRepository actions;
  private final ObjectMapper json;

  public FamilyGuard(
      FamilyAccess access,
      AlertRepository alerts,
      AgentActionRepository actions,
      ObjectMapper json) {
    this.access = access;
    this.alerts = alerts;
    this.actions = actions;
    this.json = json;
  }

  @Override
  public void addInterceptors(InterceptorRegistry r) {
    r.addInterceptor(this).addPathPatterns("/api/v1/**").excludePathPatterns("/api/v1/auth/**");
  }

  @Override
  public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
    @SuppressWarnings("unchecked")
    var vars =
        (Map<String, String>) req.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
    if (vars != null) {
      if (vars.containsKey("deviceId")) access.device(vars.get("deviceId"));
      if (vars.containsKey("robotId")) access.robot(vars.get("robotId"));
      if (vars.containsKey("alertId"))
        access.device(
            alerts
                .findById(Long.valueOf(vars.get("alertId")))
                .orElseThrow(FamilyAccess::denied)
                .getDeviceId());
      if (vars.containsKey("actionId"))
        access.device(
            actions
                .findById(Long.valueOf(vars.get("actionId")))
                .orElseThrow(FamilyAccess::denied)
                .getDeviceId());
    }
    if (req.getParameter("deviceId") != null) access.device(req.getParameter("deviceId"));
    return true;
  }

  @Override
  public boolean supports(MethodParameter p, Type t, Class<? extends HttpMessageConverter<?>> c) {
    return !p.getContainingClass().getSimpleName().equals("AuthController");
  }

  @Override
  public Object afterBodyRead(
      Object body,
      HttpInputMessage in,
      MethodParameter p,
      Type t,
      Class<? extends HttpMessageConverter<?>> c) {
    var node = json.valueToTree(body);
    if (node.hasNonNull("deviceId")) access.device(node.get("deviceId").asText());
    return body;
  }
}
