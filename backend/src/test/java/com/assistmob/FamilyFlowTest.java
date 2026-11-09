package com.assistmob;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:family;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
      "assistmob.monitoring.enabled=false"
    })
@AutoConfigureMockMvc
@org.springframework.test.context.TestExecutionListeners(
    listeners = {
      org.springframework.test.context.support.DependencyInjectionTestExecutionListener.class
    },
    inheritListeners = false)
class FamilyFlowTest {
  @Autowired com.assistmob.repository.AlertRepository alertRepository;
  @Autowired com.assistmob.repository.TelemetryRepository telemetryRepository;

  @Test
  void summaryKeepsOldPendingEmergencyAndExpiresActivity() throws Exception {
    var a = register("summary-history@example.test");
    var device = a.get("deviceId").asText();
    var token = "Bearer " + a.get("token").asText();
    var path = "/api/v1/care/" + device + "/summary";
    var reading =
        com.assistmob.model.Telemetry.builder()
            .deviceId(device)
            .speedKmh(2f)
            .recordedAt(java.time.LocalDateTime.now().minusMinutes(3))
            .build();
    telemetryRepository.saveAndFlush(reading);
    mvc.perform(get(path).header("Authorization", token))
        .andExpect(jsonPath("$.state").value("STALE"));
    reading.setRecordedAt(java.time.LocalDateTime.now());
    telemetryRepository.saveAndFlush(reading);
    mvc.perform(get(path).header("Authorization", token))
        .andExpect(jsonPath("$.state").value("MOVEMENT"));
    var emergency =
        alertRepository.saveAndFlush(
            com.assistmob.model.Alert.builder()
                .deviceId(device)
                .alertType(com.assistmob.model.enums.AlertType.SOS_BUTTON)
                .status(com.assistmob.model.enums.AlertStatus.PENDING)
                .severity(com.assistmob.model.enums.AlertSeverity.CRITICAL)
                .createdAt(java.time.LocalDateTime.now().minusDays(1))
                .build());
    for (int i = 0; i < 51; i++)
      alertRepository.save(
          com.assistmob.model.Alert.builder()
              .deviceId(device)
              .alertType(com.assistmob.model.enums.AlertType.CHECKIN_SAFE)
              .status(com.assistmob.model.enums.AlertStatus.RESOLVED)
              .severity(com.assistmob.model.enums.AlertSeverity.INFO)
              .build());
    mvc.perform(get(path).header("Authorization", token))
        .andExpect(jsonPath("$.state").value("EMERGENCY"));
  }

  @Test
  void monitoringSummaryIsWaitingForNewAccountsAndScopedToFamily() throws Exception {
    var a = register("summary-a@example.test");
    var b = register("summary-b@example.test");
    String path = "/api/v1/care/" + a.get("deviceId").asText() + "/summary";
    mvc.perform(get(path).header("Authorization", "Bearer " + a.get("token").asText()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("WAITING"))
        .andExpect(jsonPath("$.personName").value("José"));
    mvc.perform(get(path).header("Authorization", "Bearer " + b.get("token").asText()))
        .andExpect(status().isForbidden());
  }

  @Test
  void homeConfigurationPersistsAndRejectsUnconfirmedLocation() throws Exception {
    var a = register("home@example.test");
    var body = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(preferences("[]"));
    body.set(
        "home",
        json.readTree(
            "{\"version\":1,\"confirmed\":false,\"lat\":0,\"lng\":0,\"radius\":500,\"address\":{\"cep\":\"01001000\",\"street\":\"Praça"
                + " da Sé\",\"number\":\"1\",\"complement\":\"\",\"district\":\"Sé\",\"city\":\"São"
                + " Paulo\",\"state\":\"SP\"}}"));
    var token = "Bearer " + a.get("token").asText();
    mvc.perform(
            put("/api/v1/care/preferences")
                .header("Authorization", token)
                .contentType("application/json")
                .content(body.toString()))
        .andExpect(status().isBadRequest());
    var home = (com.fasterxml.jackson.databind.node.ObjectNode) body.get("home");
    home.put("confirmed", true).put("lat", -23.55).put("lng", -46.63);
    mvc.perform(
            put("/api/v1/care/preferences")
                .header("Authorization", token)
                .contentType("application/json")
                .content(body.toString()))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/care/preferences").header("Authorization", token))
        .andExpect(jsonPath("$.home.address.city").value("São Paulo"));
  }

  com.fasterxml.jackson.databind.node.ObjectNode onboarding() throws Exception {
    var body = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(preferences("[]"));
    body.put("personName", "José Silva")
        .put("personPhone", "(11) 98123-4567")
        .put("livesAlone", false)
        .put("floorPlanSource", "TEMPLATE")
        .put("onboardingStep", 4);
    body.set(
        "residents",
        json.readTree("[{\"name\":\"Ana Silva\",\"relation\":\"Esposa\",\"cpf\":\"123\"}]"));
    body.set(
        "consent",
        json.readTree(
            "{\"acceptedBy\":\"SELF\",\"termsVersion\":\"2026-11\",\"acceptedAt\":\"1999-01-01T00:00:00Z\"}"));
    body.set(
        "floorPlanTemplate", json.readTree("{\"kind\":\"HOUSE\",\"bedrooms\":2,\"bathrooms\":1}"));
    body.set(
        "cameraRooms",
        json.readTree(
            "[{\"room\":\"banheiro\",\"allowed\":true},{\"room\":\"sala\",\"allowed\":true}]"));
    body.set(
        "contatos",
        json.readTree(
            "[{\"id\":\"familia-1\",\"nome\":\"Rita Souza\",\"papel\":\"Filha\",\"telefone\":\"(21) 99876-5432\",\"discagem\":\"999\",\"avisos\":true},"
                + "{\"id\":\"samu\",\"nome\":\"SAMU\",\"papel\":\"Emergência médica\",\"telefone\":\"190\",\"discagem\":\"190\"}]"));
    return body;
  }

  JsonNode savePreferences(String token, JsonNode body) throws Exception {
    return json.readTree(
        mvc.perform(
                put("/api/v1/care/preferences")
                    .header("Authorization", token)
                    .contentType("application/json")
                    .content(body.toString()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  void onboardingFieldsPersistAreMinimizedAndKeepTheServerConsentTime() throws Exception {
    var a =
        json.readTree(
            mvc.perform(
                    post("/api/v1/auth/register")
                        .with(
                            r -> {
                              r.setRemoteAddr("onboarding");
                              return r;
                            })
                        .contentType("application/json")
                        .content(
                            "{\"name\":\"Maria\",\"email\":\"onboarding@example.test\",\"password\":\"SenhaForte123!\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
    String token = "Bearer " + a.get("token").asText();
    var saved = savePreferences(token, onboarding());
    assertEquals("Ana Silva", saved.at("/residents/0/name").asText());
    assertFalse(saved.at("/residents/0").has("cpf"));
    assertEquals(false, saved.at("/cameraRooms/0/allowed").asBoolean());
    assertEquals(true, saved.at("/cameraRooms/1/allowed").asBoolean());
    String acceptedAt = saved.at("/consent/acceptedAt").asText();
    assertNotEquals("1999-01-01T00:00:00Z", acceptedAt);
    assertEquals("onboarding@example.test", saved.at("/consent/recordedBy").asText());
    assertEquals(2, saved.at("/floorPlanTemplate/bedrooms").asInt());
    // Telefone e contatos: a discagem é do servidor; SAMU mantém o número oficial.
    assertEquals("+5511981234567", saved.at("/telefonePessoa").asText());
    assertEquals("+5521998765432", saved.at("/contatos/0/discagem").asText());
    assertEquals("192", saved.at("/contatos/1/discagem").asText());
    assertEquals("192", saved.at("/contatos/1/telefone").asText());

    var again = onboarding();
    again.put("floorPlanSource", "EXAMPLE").put("onboardingStep", 9);
    var resaved = savePreferences(token, again);
    assertEquals(acceptedAt, resaved.at("/consent/acceptedAt").asText());
    assertFalse(resaved.has("floorPlanTemplate"));
    mvc.perform(get("/api/v1/care/preferences").header("Authorization", token))
        .andExpect(jsonPath("$.onboardingStep").value(9))
        .andExpect(jsonPath("$.personPhone").value("(11) 98123-4567"));
    mvc.perform(
            get("/api/v1/care/" + a.get("deviceId").asText() + "/summary")
                .header("Authorization", token))
        .andExpect(jsonPath("$.personName").value("José Silva"));
  }

  @Test
  void onboardingFieldsAreValidated() throws Exception {
    String token = "Bearer " + register("onboarding-invalid@example.test").get("token").asText();
    var residents = json.createArrayNode();
    for (int i = 0; i < 11; i++) residents.addObject().put("name", "Morador " + i);
    java.util.List<java.util.function.Consumer<com.fasterxml.jackson.databind.node.ObjectNode>>
        broken =
            java.util.List.of(
                b -> b.put("personPhone", "1234"),
                b -> b.put("personPhone", "(11) 88123-4567"),
                b -> b.set("residents", residents),
                b -> b.put("personName", "x".repeat(101)),
                b -> ((com.fasterxml.jackson.databind.node.ObjectNode) b.get("consent"))
                    .put("acceptedBy", "GUARDIAN"),
                b -> ((com.fasterxml.jackson.databind.node.ObjectNode) b.get("consent"))
                    .put("termsVersion", "antigo"),
                b -> b.remove("floorPlanTemplate"),
                b -> b.put("floorPlanSource", "DESENHO"),
                b -> b.put("onboardingStep", 10),
                b -> ((com.fasterxml.jackson.databind.node.ObjectNode) b.at("/contatos/0"))
                    .put("telefone", "(21) 1234"),
                b -> ((com.fasterxml.jackson.databind.node.ObjectNode) b.at("/contatos/0"))
                    .put("nome", " "),
                b -> ((com.fasterxml.jackson.databind.node.ArrayNode) b.get("contatos"))
                    .add(b.at("/contatos/0").deepCopy()),
                b -> b.set("cameraRooms", json.createArrayNode().add(json.createObjectNode())));
    for (var change : broken) {
      var body = onboarding();
      change.accept(body);
      mvc.perform(
              put("/api/v1/care/preferences")
                  .header("Authorization", token)
                  .contentType("application/json")
                  .content(body.toString()))
          .andExpect(status().isBadRequest());
    }
    var guardian = onboarding();
    ((com.fasterxml.jackson.databind.node.ObjectNode) guardian.get("consent"))
        .put("acceptedBy", "GUARDIAN")
        .put("guardianName", "Ana Silva");
    assertEquals("Ana Silva", savePreferences(token, guardian).at("/consent/guardianName").asText());
  }

  @Test
  void recoveryCodeCanBeRotatedByTheLoggedAccount() throws Exception {
    var a = register("rotate@example.test");
    var next =
        json.readTree(
                mvc.perform(
                        post("/api/v1/care/recovery-code")
                            .header("Authorization", "Bearer " + a.get("token").asText()))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("recoveryCode")
            .asText();
    String reset = "{\"email\":\"rotate@example.test\",\"recoveryCode\":\"%s\",\"password\":\"OutraSenhaForte!\"}";
    mvc.perform(
            post("/api/v1/auth/reset")
                .with(
                    r -> {
                      r.setRemoteAddr("rotate-old");
                      return r;
                    })
                .contentType("application/json")
                .content(reset.formatted(a.get("recoveryCode").asText())))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/v1/auth/reset")
                .with(
                    r -> {
                      r.setRemoteAddr("rotate-new");
                      return r;
                    })
                .contentType("application/json")
                .content(reset.formatted(next)))
        .andExpect(status().isOk());
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired com.assistmob.family.FamilyAccounts accounts;
  @Autowired com.assistmob.family.FamilySessions sessions;
  @Autowired com.assistmob.security.SecurityProperties properties;
  @Autowired com.assistmob.monitoring.SafetyRules safetyRules;

  @Test
  void successfulRegistrationsDoNotBlockTheNextFamilyOnTheSameConnection() throws Exception {
    for (int i = 0; i < 6; i++) {
      mvc.perform(
              post("/api/v1/auth/register")
                  .with(
                      r -> {
                        r.setRemoteAddr("shared-network");
                        return r;
                      })
                  .contentType("application/json")
                  .content(
                      json.writeValueAsString(
                          java.util.Map.of(
                              "name",
                              "Família",
                              "email",
                              "shared" + i + "@example.test",
                              "password",
                              "SenhaForte123!",
                              "personName",
                              "Pessoa"))))
          .andExpect(status().isCreated());
    }
  }

  String preferences(String reminders) {
    return "{\"remedios\":"
        + reminders
        + ",\"endereco\":\"Endereço"
        + " privado\",\"telefonePessoa\":\"\",\"contatos\":[],\"areas\":[{\"id\":\"casa\",\"nome\":\"Casa\",\"detalhe\":\"Não"
        + " configurada\",\"lat\":0,\"lng\":0,\"raio\":500,\"ativa\":false}],\"bengala\":{\"distanciaAvisoCm\":100,\"forcaVibracao\":\"media\",\"vibracao\":true,\"apito\":true,\"farol\":true,\"detectarQuedas\":true}}";
  }

  JsonNode register(String email) throws Exception {
    return json.readTree(
        mvc.perform(
                post("/api/v1/auth/register")
                    .with(
                        r -> {
                          r.setRemoteAddr(email);
                          return r;
                        })
                    .contentType("application/json")
                    .content(
                        json.writeValueAsString(
                            java.util.Map.of(
                                "name",
                                "Maria",
                                "email",
                                email,
                                "password",
                                "SenhaForte123!",
                                "personName",
                                "José"))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  void accountsCannotReadOrControlAnotherFamily() throws Exception {
    var a = register("a@example.com");
    var b = register("b@example.com");
    String token = "Bearer " + b.get("token").asText(), device = a.get("deviceId").asText();
    var reloadedTokens = new com.assistmob.security.TokenService(accounts, sessions, properties);
    assertEquals("b@example.com", reloadedTokens.validate(b.get("token").asText()).orElseThrow());
    assertFalse(sessions.existsById(b.get("token").asText()));
    assertNotEquals(
        "SenhaForte123!", accounts.findById("b@example.com").orElseThrow().getPasswordHash());
    mvc.perform(
            put("/api/v1/care/preferences")
                .header("Authorization", "Bearer " + a.get("token").asText())
                .contentType("application/json")
                .content(preferences("[]")))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/v1/care/preferences")
                .header("Authorization", token)
                .contentType("application/json")
                .content("{\"remedios\":[],\"areas\":null}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/care/preferences").header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(content().json("{}"));
    mvc.perform(get("/api/v1/devices/" + device).header("Authorization", token))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/telemetry/recent/" + device).header("Authorization", token))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/care/" + device + "/vision").header("Authorization", token))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/v1/ai/analyze")
                .header("Authorization", token)
                .contentType("application/json")
                .content("{\"deviceId\":\"" + device + "\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            get("/api/v1/robot/" + a.get("robotId").asText() + "/state")
                .header("Authorization", token))
        .andExpect(status().isForbidden());
    var summary =
        json.readTree(
            mvc.perform(get("/api/v1/dashboard/summary").header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertEquals(1, summary.get("devices").size());
    assertEquals(
        b.get("deviceId").asText(), summary.get("devices").get(0).get("deviceId").asText());
    mvc.perform(
            post("/api/v1/auth/login")
                .contentType("application/json")
                .content("{\"username\":\"b@example.com\",\"password\":\"SenhaForte123!\"}"))
        .andExpect(status().isOk());
  }

  @Test
  void deviceKeysAndCareIdentityAreScoped() throws Exception {
    var a = register("care@example.com");
    var b = register("other@example.com");
    String body =
        json.writeValueAsString(
            java.util.Map.of(
                "deviceId",
                a.get("deviceId").asText(),
                "alertType",
                "SOS_BUTTON",
                "message",
                "Preciso de ajuda"));
    mvc.perform(
            post("/api/v1/alerts")
                .header("X-API-Key", b.get("deviceKey").asText())
                .contentType("application/json")
                .content(body))
        .andExpect(status().isForbidden());
    var alert =
        json.readTree(
            mvc.perform(
                    post("/api/v1/alerts")
                        .header("X-API-Key", a.get("deviceKey").asText())
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    String token = "Bearer " + a.get("token").asText();
    mvc.perform(
            patch("/api/v1/alerts/" + alert.get("id").asLong() + "/acknowledge")
                .header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("acknowledgedBy").value("care@example.com"));
    mvc.perform(
            patch("/api/v1/alerts/" + alert.get("id").asLong() + "/resolve")
                .param("resolvedBy", "forged")
                .header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("resolvedBy").value("care@example.com"));
  }

  @Test
  void recoveryRevokesExistingSessionsAndInvitesAreSingleUse() throws Exception {
    var a = register("recover@example.com");
    String token = "Bearer " + a.get("token").asText();
    var invite =
        json.readTree(
                mvc.perform(post("/api/v1/care/invite").header("Authorization", token))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("invite")
            .asText();
    String registration =
        json.writeValueAsString(
            java.util.Map.of(
                "name",
                "Cuidador",
                "email",
                "caregiver@example.com",
                "password",
                "SenhaForte123!",
                "personName",
                "José",
                "invite",
                invite));
    var joined =
        json.readTree(
            mvc.perform(
                    post("/api/v1/auth/register")
                        .contentType("application/json")
                        .content(registration))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertEquals(a.get("deviceId"), joined.get("deviceId"));
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType("application/json")
                .content(registration.replace("caregiver@example.com", "another@example.com")))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/v1/auth/reset")
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        java.util.Map.of(
                            "email",
                            "recover@example.com",
                            "recoveryCode",
                            a.get("recoveryCode").asText(),
                            "password",
                            "OutraSenhaForte!"))))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/dashboard/summary").header("Authorization", token))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void gesturesAreDurableIdempotentAndReviewedByTheAuthenticatedFamily() throws Exception {
    var a = register("gesture@example.com");
    String token = "Bearer " + a.get("token").asText(), device = a.get("deviceId").asText();
    String event =
        "{\"schemaVersion\":\"1.0\",\"eventId\":\"event-12345678\",\"sessionId\":\"session-12345678\",\"deviceId\":\""
            + device
            + "\",\"capturedAt\":\"2026-11-08T03:00:00Z\",\"gesture\":{\"name\":\"SIGNAL_FOR_HELP\",\"phase\":\"THUMB_TRAPPED\",\"confidence\":0.9,\"confirmed\":true},\"safety\":{\"requiresHumanReview\":true,\"automaticEmergencyCall\":false},\"quality\":{\"usable\":true},\"privacy\":{\"imageStored\":false,\"landmarksStored\":false}}";
    mvc.perform(
            post("/api/v1/vision/events")
                .header("Authorization", token)
                .contentType("application/json")
                .content(event))
        .andExpect(status().isCreated());
    mvc.perform(
            post("/api/v1/vision/events")
                .header("Authorization", token)
                .contentType("application/json")
                .content(event))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("duplicate").value(true));
    mvc.perform(get("/api/v1/care/" + device + "/alerts").header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
    mvc.perform(
            patch("/api/v1/care/" + device + "/vision/event-12345678/review")
                .param("decision", "FALSE_POSITIVE")
                .header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("reviewedBy").value("gesture@example.com"));
    mvc.perform(get("/api/v1/care/" + device + "/alerts").header("Authorization", token))
        .andExpect(jsonPath("$[0].status").value("RESOLVED"));
    mvc.perform(post("/api/v1/care/" + device + "/analyze").header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("state").value("UNAVAILABLE"));
    mvc.perform(get("/api/v1/care/" + device + "/reports").header("Authorization", token))
        .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  void overdueRemindersAreRecoveredOncePerDay() throws Exception {
    var a = register("reminder@example.com");
    String token = "Bearer " + a.get("token").asText(), device = a.get("deviceId").asText();
    mvc.perform(
            put("/api/v1/care/preferences")
                .header("Authorization", token)
                .contentType("application/json")
                .content(
                    preferences(
                        "[{\"id\":1,\"nome\":\"Lembrete de"
                            + " teste\",\"hora\":\"00:00\",\"ativo\":true}]")))
        .andExpect(status().isOk());
    safetyRules.tick();
    safetyRules.tick();
    mvc.perform(get("/api/v1/care/" + device + "/alerts").header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].alertType").value("MEDICATION_REMINDER"));
  }
}
