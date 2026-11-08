package com.assistmob.service;

import com.assistmob.dto.AgentActionResponseDTO;
import com.assistmob.dto.VisionEventRequestDTO;
import com.assistmob.dto.VisionEventResponseDTO;
import com.assistmob.model.AgentAction;
import com.assistmob.model.VisionDetectionEvent;
import com.assistmob.model.enums.AgentActionStatus;
import com.assistmob.model.enums.AgentActionType;
import com.assistmob.model.enums.AgentRiskLevel;
import com.assistmob.repository.AgentActionRepository;
import com.assistmob.repository.VisionDetectionEventRepository;
import java.time.LocalDateTime;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VisionEventService {

  private final VisionDetectionEventRepository visionEventRepository;
  private final AgentActionRepository agentActionRepository;
  private final AlertService alertService;
  private final com.assistmob.family.FamilyAccess access;
  private final com.assistmob.family.DeviceBindings bindings;

  @Transactional
  public VisionEventResponseDTO receive(VisionEventRequestDTO request) {
    bindings
        .lockDevice(request.getDeviceId())
        .orElseThrow(com.assistmob.family.FamilyAccess::denied);
    var existing = visionEventRepository.findByEventId(request.getEventId());
    if (existing.isPresent()) {
      access.device(existing.get().getDeviceId());
      AgentActionResponseDTO action =
          existing.get().getAgentActionId() == null
              ? null
              : agentActionRepository
                  .findById(existing.get().getAgentActionId())
                  .map(AgentActionResponseDTO::fromEntity)
                  .orElse(null);
      return VisionEventResponseDTO.builder()
          .eventId(request.getEventId())
          .accepted(true)
          .duplicate(true)
          .message("Evento já processado")
          .supervisedAction(action)
          .build();
    }

    validateSafetyContract(request);

    AgentAction proposal =
        AgentAction.builder()
            .deviceId(request.getDeviceId())
            .objective("Responder com segurança ao Signal for Help detectado pela câmera local.")
            .summary(
                "Possível Signal for Help detectado. Verifique a pessoa de forma discreta e"
                    + " segura.")
            .riskLevel(AgentRiskLevel.HIGH)
            .actionType(AgentActionType.CONTACT_PERSON)
            .justification(
                String.format(
                    Locale.ROOT,
                    "Sequência visual confirmada pelo OpenCV com confiança %.0f%%. A detecção não"
                        + " confirma violência ou emergência; o contexto deve ser verificado por"
                        + " uma pessoa.",
                    request.getGesture().getConfidence() * 100.0))
            .status(AgentActionStatus.PENDING_APPROVAL)
            .requiresHumanApproval(true)
            .requestedAt(LocalDateTime.now())
            .generatedModel("opencv-mediapipe-signal-for-help")
            .build();

    AgentAction savedAction = agentActionRepository.save(proposal);

    VisionDetectionEvent event =
        VisionDetectionEvent.builder()
            .eventId(request.getEventId())
            .sessionId(request.getSessionId())
            .deviceId(request.getDeviceId())
            .gestureName(request.getGesture().getName())
            .phase(request.getGesture().getPhase())
            .confidence(request.getGesture().getConfidence())
            .confirmed(request.getGesture().isConfirmed())
            .capturedAt(request.getCapturedAt())
            .receivedAt(LocalDateTime.now())
            .imageStored(false)
            .automaticEmergencyCall(false)
            .agentActionId(savedAction.getId())
            .build();
    var alert =
        alertService.createAlert(
            com.assistmob.dto.AlertRequestDTO.builder()
                .deviceId(request.getDeviceId())
                .alertType(com.assistmob.model.enums.AlertType.HAND_GESTURE_SOS)
                .severity(com.assistmob.model.enums.AlertSeverity.CRITICAL)
                .message("Possível gesto de socorro. Verificação do familiar pendente.")
                .build());
    event.setAlertId(alert.getId());
    visionEventRepository.save(event);

    return VisionEventResponseDTO.builder()
        .eventId(request.getEventId())
        .accepted(true)
        .duplicate(false)
        .message("Metadados aceitos; ação criada para revisão do familiar")
        .supervisedAction(AgentActionResponseDTO.fromEntity(savedAction))
        .build();
  }

  private void validateSafetyContract(VisionEventRequestDTO request) {
    if (!"SIGNAL_FOR_HELP".equals(request.getGesture().getName())) {
      throw new IllegalArgumentException("Gesto não suportado");
    }
    if (!request.getGesture().isConfirmed()) {
      throw new IllegalArgumentException("Somente sequências confirmadas são aceitas");
    }
    if (!request.getQuality().isUsable()) {
      throw new IllegalArgumentException("Quadro sem qualidade suficiente");
    }
    if (!request.getSafety().isRequiresHumanReview()) {
      throw new IllegalArgumentException("A revisão humana é obrigatória");
    }
    if (request.getSafety().isAutomaticEmergencyCall()) {
      throw new IllegalArgumentException("Chamadas automáticas não são permitidas");
    }
    if (request.getPrivacy().isImageStored() || request.getPrivacy().isLandmarksStored()) {
      throw new IllegalArgumentException(
          "O backend aceita somente metadados sem imagem ou landmarks");
    }
  }
}
