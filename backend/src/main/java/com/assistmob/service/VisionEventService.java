package com.assistmob.service;

import com.assistmob.dto.AgentActionResponseDTO;
import com.assistmob.dto.VisionEventRequestDTO;
import com.assistmob.dto.VisionEventHistoryDTO;
import com.assistmob.dto.VisionEventResponseDTO;
import com.assistmob.model.AgentAction;
import com.assistmob.model.VisionDetectionEvent;
import com.assistmob.model.enums.AgentActionStatus;
import com.assistmob.model.enums.AgentActionType;
import com.assistmob.model.enums.AgentRiskLevel;
import com.assistmob.repository.AgentActionRepository;
import com.assistmob.repository.VisionDetectionEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VisionEventService {

    private final VisionDetectionEventRepository visionEventRepository;
    private final AgentActionRepository agentActionRepository;

    @Transactional
    public VisionEventResponseDTO receive(VisionEventRequestDTO request) {
        var existing = visionEventRepository.findByEventId(request.getEventId());
        if (existing.isPresent()) {
            AgentActionResponseDTO action = existing.get().getAgentActionId() == null
                    ? null
                    : agentActionRepository.findById(existing.get().getAgentActionId())
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

        AgentAction proposal = AgentAction.builder()
                .deviceId(request.getDeviceId())
                .objective("Responder com segurança ao Signal for Help detectado pela câmera local.")
                .summary("Possível Signal for Help detectado. Verifique a pessoa de forma discreta e segura.")
                .riskLevel(AgentRiskLevel.HIGH)
                .actionType(AgentActionType.CONTACT_PERSON)
                .justification(String.format(Locale.ROOT,
                        "Sequência visual confirmada pelo OpenCV com confiança %.0f%%. "
                                + "A detecção não confirma violência ou emergência; o contexto deve ser verificado por uma pessoa.",
                        request.getGesture().getConfidence() * 100.0))
                .status(AgentActionStatus.PENDING_APPROVAL)
                .requiresHumanApproval(true)
                .requestedAt(LocalDateTime.now())
                .generatedModel("opencv-mediapipe-signal-for-help")
                .build();

        AgentAction savedAction = agentActionRepository.save(proposal);

        VisionDetectionEvent event = VisionDetectionEvent.builder()
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
        visionEventRepository.save(event);

        return VisionEventResponseDTO.builder()
                .eventId(request.getEventId())
                .accepted(true)
                .duplicate(false)
                .message("Metadados aceitos; ação criada para revisão do familiar")
                .supervisedAction(AgentActionResponseDTO.fromEntity(savedAction))
                .build();
    }

    @Transactional(readOnly = true)
    public List<VisionEventHistoryDTO> getRecent(String deviceId) {
        return visionEventRepository.findTop50ByDeviceIdOrderByReceivedAtDesc(deviceId)
                .stream()
                .map(VisionEventHistoryDTO::fromEntity)
                .toList();
    }

    @Transactional
    public VisionEventHistoryDTO review(String eventId, String decision, String reviewedBy) {
        VisionDetectionEvent event = visionEventRepository.findByEventId(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Evento visual não encontrado"));

        String normalizedDecision = decision == null ? "" : decision.trim().toUpperCase(Locale.ROOT);
        if (!List.of("FALSE_POSITIVE", "CANCELED").contains(normalizedDecision)) {
            throw new IllegalArgumentException("Decisão deve ser FALSE_POSITIVE ou CANCELED");
        }
        if (!"PENDING".equals(event.getReviewStatus())) {
            throw new IllegalArgumentException("Este evento já foi revisado");
        }

        LocalDateTime reviewedAt = LocalDateTime.now();
        String reviewer = reviewedBy == null || reviewedBy.isBlank() ? "Familiar" : reviewedBy.trim();
        event.setReviewStatus(normalizedDecision);
        event.setReviewedAt(reviewedAt);
        event.setReviewedBy(reviewer);

        if (event.getAgentActionId() != null) {
            agentActionRepository.findById(event.getAgentActionId()).ifPresent(action -> {
                if (action.getStatus() == AgentActionStatus.PENDING_APPROVAL) {
                    action.setStatus(AgentActionStatus.REJECTED);
                    action.setReviewedAt(reviewedAt);
                    action.setReviewedBy(reviewer);
                    action.setReviewerNote(normalizedDecision.equals("FALSE_POSITIVE")
                            ? "Detecção marcada como falso positivo pelo familiar."
                            : "Proposta cancelada pelo familiar.");
                    agentActionRepository.save(action);
                }
            });
        }

        return VisionEventHistoryDTO.fromEntity(visionEventRepository.save(event));
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
            throw new IllegalArgumentException("O backend aceita somente metadados sem imagem ou landmarks");
        }
    }
}
