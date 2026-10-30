package com.assistmob.controller;

import com.assistmob.dto.*;
import com.assistmob.security.AuthPrincipal;
import com.assistmob.service.HouseLayoutService;
import com.assistmob.service.RobotMissionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.regex.Pattern;

/** API do robô assistente (consumida pela ponte ROS 2 e pelo painel 3D). */
@RestController
@RequiredArgsConstructor
public class RobotController {

    private static final Pattern ROBOT_ID = Pattern.compile("[A-Za-z0-9_-]{1,40}");

    private final RobotMissionService robotService;
    private final HouseLayoutService houseLayoutService;

    @GetMapping("/api/v1/house/layout")
    public HouseLayoutDTO getLayout() {
        return houseLayoutService.getLayout();
    }

    @GetMapping("/api/v1/robot")
    public RobotStateDTO getDefaultRobot() {
        return robotService.getState(robotService.getDefaultRobotId());
    }

    @GetMapping("/api/v1/robot/{robotId}/state")
    public RobotStateDTO getState(@PathVariable String robotId) {
        return robotService.getState(checkId(robotId));
    }

    /** Ponte ROS 2 -> backend. A resposta traz a missão ativa: se ela sumir, o robô aborta o objetivo. */
    @PostMapping("/api/v1/robot/{robotId}/state")
    public RobotStateDTO updateState(@PathVariable String robotId, @Valid @RequestBody RobotStateUpdateDTO body) {
        return robotService.updateState(checkId(robotId), body);
    }

    @GetMapping("/api/v1/robot/{robotId}/missions")
    public List<RobotMissionDTO> listMissions(@PathVariable String robotId,
                                              @RequestParam(defaultValue = "10") int limit) {
        return robotService.listMissions(checkId(robotId), limit);
    }

    /** Comando da família (painel 3D). */
    @PostMapping("/api/v1/robot/{robotId}/missions")
    public ResponseEntity<RobotMissionDTO> requestMission(@PathVariable String robotId,
                                                          @Valid @RequestBody MissionRequestDTO body,
                                                          HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(robotService.requestMission(checkId(robotId), body, caller(request)));
    }

    @PostMapping("/api/v1/robot/{robotId}/missions/{missionId}/cancel")
    public RobotMissionDTO cancel(@PathVariable String robotId, @PathVariable Long missionId,
                                  HttpServletRequest request) {
        return robotService.cancelMission(checkId(robotId), missionId, caller(request));
    }

    /** Robô pede a próxima missão com prioridade mínima. 204 = nada para fazer. */
    @PostMapping("/api/v1/robot/{robotId}/missions/claim")
    public ResponseEntity<RobotMissionDTO> claim(@PathVariable String robotId,
                                                 @RequestParam(defaultValue = "0") int minPriority) {
        return robotService.claimNext(checkId(robotId), minPriority)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/api/v1/robot/{robotId}/missions/{missionId}/complete")
    public RobotMissionDTO complete(@PathVariable String robotId, @PathVariable Long missionId,
                                    @Valid @RequestBody MissionResultDTO body) {
        return robotService.completeMission(checkId(robotId), missionId, body);
    }

    private static String checkId(String robotId) {
        if (!ROBOT_ID.matcher(robotId).matches()) {
            throw new IllegalArgumentException("Identificador de robô inválido.");
        }
        return robotId;
    }

    private static String caller(HttpServletRequest request) {
        Object principal = request.getAttribute(AuthPrincipal.REQUEST_ATTRIBUTE);
        return principal instanceof AuthPrincipal p ? "Familiar (" + p.name() + ")" : "Familiar";
    }
}
