package com.assistmob.service;

import com.assistmob.dto.HouseLayoutDTO;
import com.assistmob.dto.HouseLayoutDTO.Door;
import com.assistmob.dto.HouseLayoutDTO.Furniture;
import com.assistmob.dto.HouseLayoutDTO.Point;
import com.assistmob.dto.HouseLayoutDTO.Room;
import com.assistmob.dto.HouseLayoutDTO.Wall;
import com.assistmob.family.CarePreferencesRepository;
import com.assistmob.family.DeviceBindings;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Planta da casa no backend.
 *
 * <p>A planta de exemplo ({@link #getLayout()}) tem os mesmos números de
 * robot-ros2/amparo_robot/amparo_robot/house_layout.py, que também gera o mundo do Gazebo
 * (worlds/casa_amparo.sdf). A família que monta a planta por um modelo no cadastro (passo 5) guarda
 * a dela nas preferências (floorPlanLayout); robô, alertas e painel passam a usar essa.
 */
@Service
public class HouseLayoutService {

    private static final Logger log = LoggerFactory.getLogger(HouseLayoutService.class);

    static final int MAX_ROOMS = 12;
    static final int MAX_WALLS = 80;
    static final int MAX_FURNITURE = 40;
    static final int MAX_DOORS = 30;
    static final int MAX_PATROL = 30;
    /** Coordenadas em metros: nenhuma casa passa de 50 m do centro. */
    static final double MAX_COORD = 50;
    private static final Pattern ROOM_ID = Pattern.compile("[a-z]{2,20}(-[0-9]{1,2})?");

    private static final HouseLayoutDTO LAYOUT = new HouseLayoutDTO(
            "Casa Amparo 2050",
            10.0,
            8.0,
            1.0,
            new Point(0.0, 0.0),
            List.of(
                    new Room("sala", "Sala de estar", -2.0, -3.0, 3.0, 1.0, 1.5, -1.5),
                    new Room("cozinha", "Cozinha", 3.0, -3.0, 8.0, 1.0, 5.5, -1.0),
                    new Room("quarto", "Quarto", -2.0, 1.0, 3.0, 5.0, 0.6, 3.0),
                    new Room("banheiro", "Banheiro", 3.0, 1.0, 5.5, 5.0, 4.2, 3.0),
                    new Room("escritorio", "Escritório", 5.5, 1.0, 8.0, 5.0, 6.9, 3.0)
            ),
            List.of(
                    // Paredes externas
                    new Wall(-2.0, -3.0, 8.0, -3.0),
                    new Wall(8.0, -3.0, 8.0, 5.0),
                    new Wall(8.0, 5.0, -2.0, 5.0),
                    new Wall(-2.0, 5.0, -2.0, -3.0),
                    // y = 1: sala | quarto (porta x 0.0..1.2) e cozinha | banheiro/escritório
                    new Wall(-2.0, 1.0, 0.0, 1.0),
                    new Wall(1.2, 1.0, 3.0, 1.0),
                    new Wall(3.0, 1.0, 3.6, 1.0),
                    new Wall(4.8, 1.0, 6.4, 1.0),
                    new Wall(7.6, 1.0, 8.0, 1.0),
                    // x = 3: sala | cozinha (porta y -1.6..-0.4) e quarto | banheiro (fechada)
                    new Wall(3.0, -3.0, 3.0, -1.6),
                    new Wall(3.0, -0.4, 3.0, 1.0),
                    new Wall(3.0, 1.0, 3.0, 5.0),
                    // x = 5.5: banheiro | escritório (fechada)
                    new Wall(5.5, 1.0, 5.5, 5.0)
            ),
            List.of(
                    new Furniture("Sofá", "sala", -1.2, -2.4, 1.4, 0.7, 0.8),
                    new Furniture("Rack da TV", "sala", -1.0, 0.7, 1.4, 0.4, 0.5),
                    new Furniture("Mesa", "cozinha", 6.6, -1.8, 1.2, 0.8, 0.75),
                    new Furniture("Bancada", "cozinha", 5.5, -2.7, 2.6, 0.5, 0.9),
                    new Furniture("Cama", "quarto", -0.8, 3.8, 1.6, 2.0, 0.5),
                    new Furniture("Pia", "banheiro", 4.9, 4.6, 0.8, 0.5, 0.85),
                    new Furniture("Escrivaninha", "escritorio", 7.3, 4.4, 1.2, 0.6, 0.75)
            ),
            List.of("quarto", "sala", "cozinha", "banheiro", "cozinha", "escritorio", "cozinha", "sala"),
            List.of(
                    new Door("sala", "quarto", 0.6, 1.0),
                    new Door("sala", "cozinha", 3.0, -1.0),
                    new Door("cozinha", "banheiro", 4.2, 1.0),
                    new Door("cozinha", "escritorio", 7.0, 1.0)
            )
    );

    private final CarePreferencesRepository preferences;
    private final DeviceBindings bindings;
    private final ObjectMapper json;

    public HouseLayoutService(CarePreferencesRepository preferences, DeviceBindings bindings, ObjectMapper json) {
        this.preferences = preferences;
        this.bindings = bindings;
        this.json = json;
    }

    /** Planta de exemplo (5 cômodos). */
    public HouseLayoutDTO getLayout() {
        return LAYOUT;
    }

    /** Planta da família: a montada pelo modelo no cadastro ou, sem ela, a de exemplo. */
    public HouseLayoutDTO forFamily(String familyId) {
        if (familyId == null) return LAYOUT;
        return preferences
                .findById(familyId)
                .map(p -> p.getSettings())
                .flatMap(this::savedLayout)
                .orElse(LAYOUT);
    }

    public HouseLayoutDTO forDevice(String deviceId) {
        if (deviceId == null) return LAYOUT;
        return forFamily(bindings.findById(deviceId).map(b -> b.getFamilyId()).orElse(null));
    }

    public HouseLayoutDTO forRobot(String robotId) {
        if (robotId == null) return LAYOUT;
        return forFamily(bindings.findByRobotId(robotId).map(b -> b.getFamilyId()).orElse(null));
    }

    private Optional<HouseLayoutDTO> savedLayout(String settings) {
        if (settings == null) return Optional.empty();
        try {
            var node = json.readTree(settings);
            if (!"TEMPLATE".equals(node.path("floorPlanSource").asText())
                    || !node.path("floorPlanLayout").isObject()) return Optional.empty();
            var layout = json.treeToValue(node.get("floorPlanLayout"), HouseLayoutDTO.class);
            return Optional.of(validate(layout));
        } catch (Exception e) {
            log.warn("Planta salva inválida; usando a de exemplo: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public Optional<Room> findRoom(String roomId) {
        return findRoom(LAYOUT, roomId);
    }

    public Optional<Room> roomAt(double x, double y) {
        return roomAt(LAYOUT, x, y);
    }

    public boolean isInsideHouse(double x, double y) {
        return roomAt(x, y).isPresent();
    }

    public static Optional<Room> findRoom(HouseLayoutDTO layout, String roomId) {
        if (roomId == null) {
            return Optional.empty();
        }
        return layout.rooms().stream()
                .filter(room -> room.id().equalsIgnoreCase(roomId.trim()))
                .findFirst();
    }

    public static Optional<Room> roomAt(HouseLayoutDTO layout, double x, double y) {
        return layout.rooms().stream()
                .filter(room -> room.contains(x, y))
                .findFirst();
    }

    /**
     * Confere uma planta enviada pelo painel (gerada a partir do modelo do passo 5) e devolve uma
     * cópia limpa. Recusa tamanhos absurdos, ids fora do padrão, cômodos invertidos e referências a
     * cômodos que não existem.
     */
    public static HouseLayoutDTO validate(HouseLayoutDTO l) {
        if (l == null || l.rooms() == null || l.walls() == null || l.dock() == null)
            throw new IllegalArgumentException("Planta inválida");
        if (l.rooms().isEmpty() || l.rooms().size() > MAX_ROOMS)
            throw new IllegalArgumentException("Planta inválida: até " + MAX_ROOMS + " cômodos");
        List<Furniture> furniture = l.furniture() == null ? List.of() : l.furniture();
        List<Door> doors = l.doors() == null ? List.of() : l.doors();
        List<String> patrol = l.patrolRoute() == null ? List.of() : l.patrolRoute();
        if (l.walls().size() > MAX_WALLS || furniture.size() > MAX_FURNITURE
                || doors.size() > MAX_DOORS || patrol.size() > MAX_PATROL)
            throw new IllegalArgumentException("Planta inválida: muitos elementos");
        Set<String> ids = new java.util.HashSet<>();
        for (Room r : l.rooms()) {
            if (r.id() == null || !ROOM_ID.matcher(r.id()).matches() || !ids.add(r.id()))
                throw new IllegalArgumentException("Planta inválida: cômodo sem id válido");
            text(r.name(), 40);
            coords(r.minX(), r.minY(), r.maxX(), r.maxY(), r.targetX(), r.targetY());
            if (r.minX() >= r.maxX() || r.minY() >= r.maxY() || !r.contains(r.targetX(), r.targetY()))
                throw new IllegalArgumentException("Planta inválida: cômodo " + r.id());
        }
        for (Wall w : l.walls()) coords(w.x1(), w.y1(), w.x2(), w.y2());
        for (Furniture f : furniture) {
            text(f.name(), 40);
            coords(f.x(), f.y(), f.sizeX(), f.sizeY(), f.height());
            if (!ids.contains(f.roomId()) || f.sizeX() <= 0 || f.sizeY() <= 0 || f.height() <= 0 || f.height() > 3)
                throw new IllegalArgumentException("Planta inválida: móvel");
        }
        for (Door d : doors) {
            coords(d.x(), d.y());
            if (!ids.contains(d.a()) || !ids.contains(d.b()))
                throw new IllegalArgumentException("Planta inválida: porta");
        }
        for (String id : patrol)
            if (!ids.contains(id)) throw new IllegalArgumentException("Planta inválida: rota");
        coords(l.dock().x(), l.dock().y(), l.width(), l.depth(), l.wallHeight());
        HouseLayoutDTO clean = new HouseLayoutDTO(
                text(l.name(), 60), l.width(), l.depth(), l.wallHeight(), l.dock(),
                List.copyOf(l.rooms()), List.copyOf(l.walls()), List.copyOf(furniture),
                List.copyOf(patrol), List.copyOf(doors));
        if (roomAt(clean, l.dock().x(), l.dock().y()).isEmpty())
            throw new IllegalArgumentException("Planta inválida: a base do robô fica fora da casa");
        return clean;
    }

    private static String text(String s, int max) {
        if (s == null || s.isBlank() || s.length() > max)
            throw new IllegalArgumentException("Planta inválida: nome");
        return s;
    }

    private static void coords(double... values) {
        for (double v : values)
            if (!Double.isFinite(v) || Math.abs(v) > MAX_COORD)
                throw new IllegalArgumentException("Planta inválida: medida fora do limite");
    }
}
