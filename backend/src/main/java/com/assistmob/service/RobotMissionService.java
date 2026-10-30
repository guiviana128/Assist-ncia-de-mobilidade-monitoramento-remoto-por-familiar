package com.assistmob.service;

import com.assistmob.dto.*;
import com.assistmob.dto.HouseLayoutDTO.Point;
import com.assistmob.dto.HouseLayoutDTO.Room;
import com.assistmob.event.AlertCreatedEvent;
import com.assistmob.model.Alert;
import com.assistmob.model.RobotMission;
import com.assistmob.model.enums.*;
import com.assistmob.repository.RobotMissionRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;

/**
 * Coordena o robô assistente da casa.
 *
 * - Escuta os alertas (Observer): queda, SOS ou gesto de socorro viram uma missão RESPOND_TO_ALERT
 *   para o cômodo onde a pessoa está.
 * - Recebe comandos da família pelo painel 3D (ir a um cômodo, ir a um ponto clicado, patrulhar, voltar).
 * - Entrega missões ao robô por prioridade: socorro (100) interrompe comando manual (50),
 *   que interrompe patrulha (10).
 */
@Service
@RequiredArgsConstructor
public class RobotMissionService {

    private static final Logger log = LoggerFactory.getLogger(RobotMissionService.class);
    private static final Set<AlertType> EMERGENCIES =
            EnumSet.of(AlertType.SOS_BUTTON, AlertType.FALL_DETECTED, AlertType.HAND_GESTURE_SOS);
    private static final Duration ONLINE_WINDOW = Duration.ofSeconds(5);

    private final RobotMissionRepository missionRepository;
    private final HouseLayoutService houseLayoutService;
    private final PersonLocationTracker personLocationTracker;
    private final AlertService alertService;

    @Value("${assistmob.robot.default-id:AMPARO-BOT-01}")
    private String defaultRobotId;

    @Value("${assistmob.robot.default-person-room:sala}")
    private String defaultPersonRoom;

    /** Último estado recebido de cada robô (volátil: é telemetria de alta frequência). */
    private final Map<String, Snapshot> states = new ConcurrentHashMap<>();

    private record Snapshot(RobotStateUpdateDTO data, LocalDateTime receivedAt) {
    }

    public String getDefaultRobotId() {
        return defaultRobotId;
    }

    // ------------------------------------------------------------------ estado

    @Transactional(readOnly = true)
    public RobotStateDTO updateState(String robotId, RobotStateUpdateDTO dto) {
        states.put(robotId, new Snapshot(dto, LocalDateTime.now()));
        return getState(robotId);
    }

    @Transactional(readOnly = true)
    public RobotStateDTO getState(String robotId) {
        RobotMissionDTO current = activeMission(robotId).map(RobotMissionDTO::fromEntity).orElse(null);
        String personRoom = personLocationTracker.mostRecent()
                .map(PersonLocationTracker.Sighting::roomId)
                .orElse(null);
        Snapshot snapshot = states.get(robotId);

        if (snapshot == null) {
            Point dock = houseLayoutService.getLayout().dock();
            return new RobotStateDTO(robotId, false, dock.x(), dock.y(), 0.0, RobotMode.OFFLINE,
                    roomIdAt(dock.x(), dock.y()), null, null, "Aguardando conexão do robô",
                    current, personRoom, null);
        }

        RobotStateUpdateDTO s = snapshot.data();
        boolean online = Duration.between(snapshot.receivedAt(), LocalDateTime.now()).compareTo(ONLINE_WINDOW) < 0;
        return new RobotStateDTO(robotId, online, s.x(), s.y(), s.yaw(),
                online ? s.mode() : RobotMode.OFFLINE, roomIdAt(s.x(), s.y()), s.batteryPercent(),
                s.nearestObstacleM(), s.navStatus(), current, personRoom, snapshot.receivedAt());
    }

    // ------------------------------------------------------------------ comandos da família

    @Transactional
    public RobotMissionDTO requestMission(String robotId, MissionRequestDTO request, String requestedBy) {
        if (!request.type().isFamilyCommand()) {
            throw new IllegalArgumentException("Missões de socorro são criadas automaticamente a partir dos alertas.");
        }

        RobotMission.RobotMissionBuilder builder = RobotMission.builder()
                .robotId(robotId)
                .type(request.type())
                .status(MissionStatus.PENDING)
                .requestedBy(requestedBy)
                .reason(cleanText(request.reason(), defaultReason(request.type())));

        switch (request.type()) {
            case GO_TO_ROOM -> {
                Room room = houseLayoutService.findRoom(request.targetRoom())
                        .orElseThrow(() -> new IllegalArgumentException("Cômodo desconhecido: " + request.targetRoom()));
                builder.targetRoom(room.id()).targetX(room.targetX()).targetY(room.targetY());
            }
            case GO_TO_POINT -> {
                if (request.targetX() == null || request.targetY() == null) {
                    throw new IllegalArgumentException("Informe targetX e targetY para ir até um ponto.");
                }
                if (!houseLayoutService.isInsideHouse(request.targetX(), request.targetY())) {
                    throw new IllegalArgumentException("O ponto escolhido está fora da planta da casa.");
                }
                builder.targetX(request.targetX()).targetY(request.targetY())
                        .targetRoom(roomIdAt(request.targetX(), request.targetY()));
            }
            case RETURN_TO_DOCK -> {
                Point dock = houseLayoutService.getLayout().dock();
                builder.targetX(dock.x()).targetY(dock.y()).targetRoom(roomIdAt(dock.x(), dock.y()));
            }
            case PATROL -> {
                // A rota de patrulha fica no próprio robô (house_layout.PATROL_ROUTE)
            }
            default -> throw new IllegalArgumentException("Tipo de missão não suportado: " + request.type());
        }

        // Só vale o comando manual mais recente: os anteriores ainda pendentes são cancelados.
        cancelWhere(robotId, MissionStatus.PENDING, m -> m.getType().isFamilyCommand(),
                "Substituída por um comando mais recente");

        RobotMission saved = missionRepository.save(builder.build());
        log.info("[ROBÔ] Comando da família: {} -> {}", saved.getType(), saved.getTargetRoom());
        return RobotMissionDTO.fromEntity(saved);
    }

    @Transactional
    public RobotMissionDTO cancelMission(String robotId, Long missionId, String cancelledBy) {
        RobotMission mission = findOwned(robotId, missionId);
        if (mission.getStatus().isFinished()) {
            throw new IllegalArgumentException("A missão já foi finalizada.");
        }
        finish(mission, MissionStatus.CANCELLED, "Cancelada por " + cancelledBy);
        return RobotMissionDTO.fromEntity(missionRepository.save(mission));
    }

    @Transactional(readOnly = true)
    public List<RobotMissionDTO> listMissions(String robotId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return missionRepository.findByRobotIdOrderByCreatedAtDesc(robotId, PageRequest.of(0, safeLimit))
                .stream()
                .map(RobotMissionDTO::fromEntity)
                .toList();
    }

    // ------------------------------------------------------------------ chamadas do robô

    /**
     * O robô pede a próxima missão com prioridade mínima. Ex.: patrulhando ele pede minPriority=0;
     * atendendo um comando manual pede 50 (só socorro ou um comando manual mais novo o interrompem).
     */
    @Transactional
    public Optional<RobotMissionDTO> claimNext(String robotId, int minPriority) {
        Optional<RobotMission> next = missionRepository.findByRobotIdAndStatus(robotId, MissionStatus.PENDING)
                .stream()
                .filter(m -> m.getType().getPriority() >= minPriority)
                .max(Comparator.comparingInt((RobotMission m) -> m.getType().getPriority())
                        .thenComparing(RobotMission::getCreatedAt, Comparator.reverseOrder()));

        if (next.isEmpty()) {
            return Optional.empty();
        }

        RobotMission mission = next.get();
        cancelWhere(robotId, MissionStatus.IN_PROGRESS, m -> true,
                "Interrompida pela missão " + mission.getType());
        mission.setStatus(MissionStatus.IN_PROGRESS);
        mission.setStartedAt(LocalDateTime.now());
        log.info("[ROBÔ] {} iniciou a missão #{} ({})", robotId, mission.getId(), mission.getType());
        return Optional.of(RobotMissionDTO.fromEntity(missionRepository.save(mission)));
    }

    @Transactional
    public RobotMissionDTO completeMission(String robotId, Long missionId, MissionResultDTO result) {
        RobotMission mission = findOwned(robotId, missionId);
        if (mission.getStatus() != MissionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("A missão não está em andamento (status " + mission.getStatus() + ").");
        }

        boolean success = Boolean.TRUE.equals(result.success());
        finish(mission, success ? MissionStatus.COMPLETED : MissionStatus.FAILED,
                cleanText(result.message(), success ? "Missão concluída" : "Falha na navegação"));
        RobotMission saved = missionRepository.save(mission);

        if (saved.getType() == MissionType.RESPOND_TO_ALERT) {
            notifyFamily(saved, success);
        }
        return RobotMissionDTO.fromEntity(saved);
    }

    // ------------------------------------------------------------------ Observer: alertas -> missão

    @EventListener
    @Transactional
    public void onAlertCreated(AlertCreatedEvent event) {
        Alert alert = event.alert();
        if (!EMERGENCIES.contains(alert.getAlertType()) || missionRepository.existsByAlertId(alert.getId())) {
            return;
        }

        Room room = Optional.ofNullable(alert.getIndoorRoom())
                .flatMap(houseLayoutService::findRoom)
                .or(() -> personLocationTracker.lastSighting(alert.getDeviceId())
                        .flatMap(sighting -> houseLayoutService.findRoom(sighting.roomId())))
                .or(() -> houseLayoutService.findRoom(defaultPersonRoom))
                .orElseThrow(() -> new IllegalStateException("Planta sem cômodo padrão"));

        RobotMission mission = missionRepository.save(RobotMission.builder()
                .robotId(defaultRobotId)
                .type(MissionType.RESPOND_TO_ALERT)
                .status(MissionStatus.PENDING)
                .targetRoom(room.id())
                .targetX(room.targetX())
                .targetY(room.targetY())
                .alertId(alert.getId())
                .deviceId(alert.getDeviceId())
                .reason(describe(alert.getAlertType()) + " · " + room.name())
                .requestedBy("Sistema (alerta #" + alert.getId() + ")")
                .build());

        log.warn("[ROBÔ] Alerta #{} ({}) -> missão de socorro #{} para {}",
                alert.getId(), alert.getAlertType(), mission.getId(), room.name());
    }

    // ------------------------------------------------------------------ auxiliares

    private void notifyFamily(RobotMission mission, boolean success) {
        String roomName = houseLayoutService.findRoom(mission.getTargetRoom()).map(Room::name).orElse("cômodo");
        String deviceId = mission.getDeviceId() != null ? mission.getDeviceId() : mission.getRobotId();
        alertService.createAlert(AlertRequestDTO.builder()
                .deviceId(deviceId)
                .alertType(success ? AlertType.ROBOT_ARRIVED : AlertType.ROBOT_MISSION_FAILED)
                .severity(success ? AlertSeverity.WARNING : AlertSeverity.CRITICAL)
                .indoorRoom(mission.getTargetRoom())
                .message(success
                        ? "Robô chegou até a pessoa (" + roomName + "). Veja pelos olhos do robô no painel 3D."
                        : "Robô não conseguiu chegar até a pessoa (" + roomName + "). Verifique pessoalmente ou ligue.")
                .build());
    }

    private Optional<RobotMission> activeMission(String robotId) {
        return missionRepository.findFirstByRobotIdAndStatusOrderByStartedAtDesc(robotId, MissionStatus.IN_PROGRESS);
    }

    private RobotMission findOwned(String robotId, Long missionId) {
        RobotMission mission = missionRepository.findById(missionId)
                .orElseThrow(() -> new IllegalArgumentException("Missão não encontrada: " + missionId));
        if (!mission.getRobotId().equals(robotId)) {
            throw new IllegalArgumentException("A missão não pertence a este robô.");
        }
        return mission;
    }

    private void cancelWhere(String robotId, MissionStatus status, Predicate<RobotMission> filter, String reason) {
        missionRepository.findByRobotIdAndStatus(robotId, status).stream()
                .filter(filter)
                .forEach(m -> {
                    finish(m, MissionStatus.CANCELLED, reason);
                    missionRepository.save(m);
                });
    }

    private static void finish(RobotMission mission, MissionStatus status, String message) {
        mission.setStatus(status);
        mission.setFinishedAt(LocalDateTime.now());
        mission.setResultMessage(message);
    }

    private String roomIdAt(double x, double y) {
        return houseLayoutService.roomAt(x, y).map(Room::id).orElse(null);
    }

    private static String describe(AlertType type) {
        return switch (type) {
            case FALL_DETECTED -> "Queda detectada pela bengala";
            case SOS_BUTTON -> "Botão SOS acionado";
            case HAND_GESTURE_SOS -> "Gesto de socorro na câmera";
            default -> type.name();
        };
    }

    private static String defaultReason(MissionType type) {
        return switch (type) {
            case GO_TO_ROOM -> "Ir até o cômodo";
            case GO_TO_POINT -> "Ir até o ponto escolhido na planta";
            case RETURN_TO_DOCK -> "Voltar para a base";
            case PATROL -> "Patrulhar a casa";
            case RESPOND_TO_ALERT -> "Atender alerta";
        };
    }

    /** Remove caracteres de controle e limita o tamanho (texto vem de fora do sistema). */
    private static String cleanText(String text, String fallback) {
        if (text == null || text.isBlank()) {
            return fallback;
        }
        String cleaned = text.replaceAll("\\p{Cntrl}", " ").trim();
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }
}
