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
  private final DeviceBindings bindings;
  private final com.assistmob.repository.DeviceRepository devices;

  public PreferencesController(
      CarePreferencesRepository p,
      FamilyAccess a,
      ObjectMapper j,
      DeviceBindings b,
      com.assistmob.repository.DeviceRepository d) {
    preferences = p;
    access = a;
    json = j;
    bindings = b;
    devices = d;
  }

  @GetMapping
  public JsonNode get() throws Exception {
    var p = preferences.findById(access.family());
    return p.isPresent() ? json.readTree(p.get().getSettings()) : json.createObjectNode();
  }

  @PutMapping
  @Transactional
  public JsonNode save(@RequestBody JsonNode body) throws Exception {
    validate(body, body.toString());
    String family = access.family();
    var p = preferences.findById(family).orElseGet(CarePreferences::new);
    JsonNode previous =
        p.getSettings() == null ? json.createObjectNode() : json.readTree(p.getSettings());
    var normalized = (com.fasterxml.jackson.databind.node.ObjectNode) body;
    OnboardingPreferences.normalize(normalized, previous, access.actor(), java.time.Instant.now());
    String data = normalized.toString();
    if (data.length() > 18000) throw new IllegalArgumentException("Preferências inválidas");
    p.setFamilyId(family);
    p.setSettings(data);
    preferences.save(p);
    renamePerson(family, normalized.path("personName").asText("").trim());
    return normalized;
  }

  /** O nome de quem é acompanhado também vive no vínculo e no nome do dispositivo (o painel lê dali). */
  private void renamePerson(String family, String name) {
    if (name.isEmpty()) return;
    for (var b : bindings.findByFamilyId(family)) {
      if (name.equals(b.getPersonName())) continue;
      b.setPersonName(name);
      bindings.save(b);
      devices
          .findById(b.getDeviceId())
          .ifPresent(
              d -> {
                d.setName("Dispositivo Amparo (" + name + ")");
                devices.save(d);
              });
    }
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
    text(b, "endereco", 350);
    if (b.hasNonNull("home")) {
      var h = b.path("home");
      var a = h.path("address");
      if (!h.isObject()
          || h.path("version").asInt() != 1
          || !h.path("confirmed").asBoolean()
          || !h.path("lat").isNumber()
          || !h.path("lng").isNumber()
          || !Double.isFinite(h.path("lat").asDouble())
          || !Double.isFinite(h.path("lng").asDouble())
          || h.path("lat").asDouble() < -25.5
          || h.path("lat").asDouble() > -19.5
          || h.path("lng").asDouble() < -53.5
          || h.path("lng").asDouble() > -44
          || !h.path("radius").isNumber()
          || h.path("radius").asDouble() < 10
          || h.path("radius").asDouble() > 10000
          || !a.path("state").asText().equals("SP"))
        throw new IllegalArgumentException("Confirme uma localização válida da casa em SP");
      text(a, "street", 100);
      text(a, "number", 15);
      text(a, "complement", 60);
      text(a, "district", 60);
      text(a, "city", 60);
      text(a, "state", 2);
      text(a, "cep", 9);
      if (a.path("street").asText().isBlank()
          || a.path("number").asText().isBlank()
          || a.path("city").asText().isBlank())
        throw new IllegalArgumentException("Preencha rua, número e cidade");
    }
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
      if (!c.path("discagem").asText().matches("\\+?[0-9]{3,15}"))
        throw new IllegalArgumentException("Telefone de contato inválido");
      if (c.has("avisos") && !c.get("avisos").isBoolean())
        throw new IllegalArgumentException("Campo inválido: avisos");
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
