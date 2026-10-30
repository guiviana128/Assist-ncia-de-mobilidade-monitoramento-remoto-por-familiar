package com.assistmob.service;

import com.assistmob.dto.HouseLayoutDTO;
import com.assistmob.dto.HouseLayoutDTO.Furniture;
import com.assistmob.dto.HouseLayoutDTO.Point;
import com.assistmob.dto.HouseLayoutDTO.Room;
import com.assistmob.dto.HouseLayoutDTO.Wall;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Fonte única da planta da casa no backend.
 * Os mesmos números estão em robot-ros2/amparo_robot/amparo_robot/house_layout.py,
 * que também gera o mundo do Gazebo (worlds/casa_amparo.sdf).
 */
@Service
public class HouseLayoutService {

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
            List.of("quarto", "sala", "cozinha", "banheiro", "cozinha", "escritorio", "cozinha", "sala")
    );

    public HouseLayoutDTO getLayout() {
        return LAYOUT;
    }

    public Optional<Room> findRoom(String roomId) {
        if (roomId == null) {
            return Optional.empty();
        }
        return LAYOUT.rooms().stream()
                .filter(room -> room.id().equalsIgnoreCase(roomId.trim()))
                .findFirst();
    }

    public Optional<Room> roomAt(double x, double y) {
        return LAYOUT.rooms().stream()
                .filter(room -> room.contains(x, y))
                .findFirst();
    }

    public boolean isInsideHouse(double x, double y) {
        return roomAt(x, y).isPresent();
    }
}
