package com.assistmob.dto;

import java.util.List;

/**
 * Planta da casa inteligente, em metros, no mesmo frame "map" usado pelo ROS 2 (o robô nasce em 0,0).
 * O painel 3D desenha paredes, móveis e cômodos a partir daqui; o robô usa os pontos-alvo dos cômodos.
 */
public record HouseLayoutDTO(
        String name,
        double width,
        double depth,
        double wallHeight,
        Point dock,
        List<Room> rooms,
        List<Wall> walls,
        List<Furniture> furniture,
        List<String> patrolRoute
) {
    public record Point(double x, double y) {
    }

    public record Room(String id, String name, double minX, double minY, double maxX, double maxY,
                       double targetX, double targetY) {
        public boolean contains(double x, double y) {
            return x >= minX && x <= maxX && y >= minY && y <= maxY;
        }
    }

    public record Wall(double x1, double y1, double x2, double y2) {
    }

    public record Furniture(String name, String roomId, double x, double y, double sizeX, double sizeY,
                            double height) {
    }
}
