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
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired com.assistmob.family.FamilyAccounts accounts;
  @Autowired com.assistmob.family.FamilySessions sessions;
  @Autowired com.assistmob.security.SecurityProperties properties;
  @Autowired com.assistmob.monitoring.SafetyRules safetyRules;

  @Test
  void successfulRegistrationsDoNotBlockTheNextFamilyOnTheSameConnection() throws Exception {
    for(int i=0;i<6;i++) {
      mvc.perform(post("/api/v1/auth/register").with(r->{r.setRemoteAddr("shared-network");return r;})
        .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("name","Família","email","shared"+i+"@example.test","password","SenhaForte123!","personName","Pessoa"))))
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
