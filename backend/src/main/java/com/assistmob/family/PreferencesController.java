package com.assistmob.family;

import com.fasterxml.jackson.databind.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/care/preferences")
public class PreferencesController {
  private final CarePreferencesRepository preferences;
  private final FamilyAccess access;
  private final ObjectMapper json;

  public PreferencesController(CarePreferencesRepository p, FamilyAccess a, ObjectMapper j) {
    preferences = p;
    access = a;
    json = j;
  }

  @GetMapping
  public JsonNode get() throws Exception {
    var p = preferences.findById(access.family());
    return p.isPresent() ? json.readTree(p.get().getSettings()) : json.createObjectNode();
  }

  @PutMapping
  @Transactional
  public JsonNode save(@RequestBody JsonNode body) {
    String data = body.toString();
    validate(body, data);
    var p = preferences.findById(access.family()).orElseGet(CarePreferences::new);
    p.setFamilyId(access.family());
    p.setSettings(data);
    preferences.save(p);
    return body;
  }

  private void validate(JsonNode b, String data) {
    if (!b.isObject()
        || data.length() > 18000
        || !b.path("remedios").isArray()
        || b.path("remedios").size() > 50
        || !b.path("contatos").isArray()
        || b.path("contatos").size() > 20
        || !b.path("areas").isArray()
        || b.path("areas").isEmpty()
        || b.path("areas").size() > 20
        || !b.path("bengala").isObject())
      throw new IllegalArgumentException("Preferências inválidas");
    text(b, "telefonePessoa", 30);
    text(b, "endereco", 200);
    for (var m : b.path("remedios")) {
      text(m, "nome", 100);
      if (!m.path("id").isNumber() || !m.path("ativo").isBoolean())
        throw new IllegalArgumentException("Lembrete inválido");
      try {
        java.time.LocalTime.parse(m.path("hora").asText());
      } catch (Exception e) {
        throw new IllegalArgumentException("Horário inválido");
      }
    }
    for (var a : b.path("areas")) {
      text(a, "id", 60);
      text(a, "nome", 100);
      text(a, "detalhe", 200);
      if (!a.path("lat").isNumber()
          || Math.abs(a.path("lat").asDouble()) > 90
          || !a.path("lng").isNumber()
          || Math.abs(a.path("lng").asDouble()) > 180
          || !a.path("raio").isNumber()
          || a.path("raio").asDouble() < 10
          || a.path("raio").asDouble() > 10000
          || !a.path("ativa").isBoolean())
        throw new IllegalArgumentException("Área segura inválida");
    }
    for (var c : b.path("contatos")) {
      for (String field : java.util.List.of("id", "nome", "papel", "telefone", "discagem"))
        text(c, field, 120);
    }
    var cane = b.path("bengala");
    if (!cane.path("distanciaAvisoCm").isNumber()
        || cane.path("distanciaAvisoCm").asDouble() < 1
        || cane.path("distanciaAvisoCm").asDouble() > 1000
        || !java.util.Set.of("fraca", "media", "forte")
            .contains(cane.path("forcaVibracao").asText()))
      throw new IllegalArgumentException("Preferência da bengala inválida");
    for (String field : java.util.List.of("vibracao", "apito", "farol", "detectarQuedas"))
      if (!cane.path(field).isBoolean()) throw new IllegalArgumentException("Preferência inválida");
  }

  private void text(JsonNode b, String key, int max) {
    if (!b.path(key).isTextual() || b.path(key).asText().length() > max)
      throw new IllegalArgumentException("Campo inválido: " + key);
  }
}
