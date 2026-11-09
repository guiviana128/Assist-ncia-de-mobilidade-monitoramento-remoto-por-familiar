package com.assistmob.family;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Campos do cadastro em 8 passos guardados nas preferências da família.
 *
 * <p>Todos são opcionais (famílias criadas antes do cadastro novo não os têm). Quando presentes, são
 * validados e reescritos só com os campos conhecidos, para não guardar nada além do que o cadastro
 * pede. As mensagens de erro citam o campo, nunca o valor (nada pessoal vai para o log ou a resposta).
 */
final class OnboardingPreferences {
  /** Versão do termo de consentimento mostrado no passo 3 do cadastro. */
  static final String TERMS_VERSION = "2026-11";

  static final int MAX_RESIDENTS = 10;
  static final int MAX_CAMERA_ROOMS = 20;
  static final int MAX_NAME = 100;
  /** Último valor de onboardingStep: o cadastro terminou. */
  static final int ONBOARDING_DONE = 9;

  private static final Pattern PHONE_CHARS = Pattern.compile("[0-9()+\\-\\s.]{8,20}");
  private static final Pattern BATHROOM = Pattern.compile("^(banheiro|lavabo)(-\\d+)?$");
  private static final Set<String> FLOOR_PLAN_SOURCES = Set.of("ROBOT", "TEMPLATE", "EXAMPLE");
  private static final Set<String> TEMPLATE_KINDS = Set.of("HOUSE", "APARTMENT");
  private static final Set<String> ACCEPTED_BY = Set.of("SELF", "GUARDIAN");

  private OnboardingPreferences() {}

  /**
   * Telefone brasileiro: DDD + 8 ou 9 dígitos, com ou sem +55, parênteses, espaço e hífen. Celular
   * (11 dígitos) começa com 9 depois do DDD.
   */
  static boolean brazilianPhone(String raw) {
    if (raw == null || !PHONE_CHARS.matcher(raw).matches()) return false;
    String digits = raw.replaceAll("\\D", "");
    if (digits.startsWith("55") && (digits.length() == 12 || digits.length() == 13))
      digits = digits.substring(2);
    if (digits.length() != 10 && digits.length() != 11) return false;
    if (digits.charAt(0) == '0' || digits.charAt(1) == '0') return false;
    return digits.length() == 10 || digits.charAt(2) == '9';
  }

  static boolean isBathroom(String roomId) {
    return BATHROOM.matcher(roomId.trim().toLowerCase(java.util.Locale.ROOT)).matches();
  }

  /**
   * Valida e normaliza os campos do cadastro em {@code body}.
   *
   * @param previous preferências já salvas (para manter a data do consentimento)
   * @param actor e-mail da conta que está salvando
   * @param now instante usado para registrar um consentimento novo
   */
  static void normalize(ObjectNode body, JsonNode previous, String actor, Instant now) {
    optionalText(body, "personName", MAX_NAME);
    if (body.hasNonNull("personPhone")) {
      String phone = text(body, "personPhone", 20);
      if (!phone.isBlank() && !brazilianPhone(phone))
        throw new IllegalArgumentException("Telefone inválido: use DDD e número, ex. (11) 98123-4567");
    }
    if (body.hasNonNull("livesAlone") && !body.get("livesAlone").isBoolean())
      throw new IllegalArgumentException("Campo inválido: livesAlone");
    normalizeResidents(body);
    normalizeConsent(body, previous.path("consent"), actor, now);
    normalizeFloorPlan(body);
    normalizeCameraRooms(body);
    if (body.hasNonNull("onboardingStep")) {
      var step = body.get("onboardingStep");
      if (!step.canConvertToInt()
          || !step.isIntegralNumber()
          || step.asInt() < 1
          || step.asInt() > ONBOARDING_DONE)
        throw new IllegalArgumentException("Campo inválido: onboardingStep");
    }
  }

  private static void normalizeResidents(ObjectNode body) {
    if (!body.hasNonNull("residents")) return;
    var list = body.get("residents");
    if (!list.isArray() || list.size() > MAX_RESIDENTS)
      throw new IllegalArgumentException("Até " + MAX_RESIDENTS + " moradores");
    ArrayNode clean = JsonNodeFactory.instance.arrayNode();
    for (var r : list) {
      String name = text(r, "name", MAX_NAME).trim();
      String relation = r.hasNonNull("relation") ? text(r, "relation", 60).trim() : "";
      if (name.isEmpty()) throw new IllegalArgumentException("Informe o nome do morador");
      clean.addObject().put("name", name).put("relation", relation);
    }
    body.set("residents", clean);
  }

  private static void normalizeConsent(
      ObjectNode body, JsonNode previous, String actor, Instant now) {
    if (!body.has("consent") || body.get("consent").isNull()) return;
    var c = body.get("consent");
    if (!c.isObject()) throw new IllegalArgumentException("Campo inválido: consent");
    String acceptedBy = c.path("acceptedBy").asText();
    if (!ACCEPTED_BY.contains(acceptedBy))
      throw new IllegalArgumentException("Campo inválido: consent.acceptedBy");
    if (!TERMS_VERSION.equals(c.path("termsVersion").asText()))
      throw new IllegalArgumentException("Versão do termo desatualizada. Leia o termo novamente.");
    String guardian = "";
    if (acceptedBy.equals("GUARDIAN")) {
      guardian = text(c, "guardianName", MAX_NAME).trim();
      if (guardian.isEmpty())
        throw new IllegalArgumentException("Informe o nome do responsável legal");
    }
    ObjectNode clean = JsonNodeFactory.instance.objectNode();
    clean.put("acceptedBy", acceptedBy);
    if (!guardian.isEmpty()) clean.put("guardianName", guardian);
    clean.put("termsVersion", TERMS_VERSION);
    // A data é do servidor. Um aceite igual ao já salvo mantém a data e quem registrou.
    boolean same =
        previous.isObject()
            && acceptedBy.equals(previous.path("acceptedBy").asText())
            && guardian.equals(previous.path("guardianName").asText(""))
            && TERMS_VERSION.equals(previous.path("termsVersion").asText())
            && previous.path("acceptedAt").isTextual();
    clean.put("acceptedAt", same ? previous.get("acceptedAt").asText() : now.toString());
    clean.put(
        "recordedBy",
        same && previous.path("recordedBy").isTextual()
            ? previous.get("recordedBy").asText()
            : actor);
    body.set("consent", clean);
  }

  private static void normalizeFloorPlan(ObjectNode body) {
    if (!body.hasNonNull("floorPlanSource")) {
      body.remove("floorPlanTemplate");
      return;
    }
    String source = body.get("floorPlanSource").asText();
    if (!FLOOR_PLAN_SOURCES.contains(source))
      throw new IllegalArgumentException("Campo inválido: floorPlanSource");
    if (!source.equals("TEMPLATE")) {
      body.remove("floorPlanTemplate");
      return;
    }
    var t = body.path("floorPlanTemplate");
    if (!t.isObject()
        || !TEMPLATE_KINDS.contains(t.path("kind").asText())
        || !t.path("bedrooms").isInt()
        || t.path("bedrooms").asInt() < 1
        || t.path("bedrooms").asInt() > 4
        || !t.path("bathrooms").isInt()
        || t.path("bathrooms").asInt() < 1
        || t.path("bathrooms").asInt() > 3)
      throw new IllegalArgumentException("Modelo da planta inválido");
    ObjectNode clean = JsonNodeFactory.instance.objectNode();
    clean.put("kind", t.path("kind").asText());
    clean.put("bedrooms", t.path("bedrooms").asInt());
    clean.put("bathrooms", t.path("bathrooms").asInt());
    body.set("floorPlanTemplate", clean);
  }

  private static void normalizeCameraRooms(ObjectNode body) {
    if (!body.hasNonNull("cameraRooms")) return;
    var list = body.get("cameraRooms");
    if (!list.isArray() || list.size() > MAX_CAMERA_ROOMS)
      throw new IllegalArgumentException("Campo inválido: cameraRooms");
    ArrayNode clean = JsonNodeFactory.instance.arrayNode();
    for (var r : list) {
      String room = text(r, "room", 60).trim();
      if (room.isEmpty() || !r.path("allowed").isBoolean())
        throw new IllegalArgumentException("Campo inválido: cameraRooms");
      // O banheiro nunca é filmado, mesmo que o cliente peça.
      clean
          .addObject()
          .put("room", room)
          .put("allowed", !isBathroom(room) && r.get("allowed").asBoolean());
    }
    body.set("cameraRooms", clean);
  }

  private static void optionalText(JsonNode b, String key, int max) {
    if (b.hasNonNull(key)) text(b, key, max);
  }

  private static String text(JsonNode b, String key, int max) {
    if (!b.path(key).isTextual() || b.path(key).asText().length() > max)
      throw new IllegalArgumentException("Campo inválido: " + key);
    return b.path(key).asText();
  }
}
