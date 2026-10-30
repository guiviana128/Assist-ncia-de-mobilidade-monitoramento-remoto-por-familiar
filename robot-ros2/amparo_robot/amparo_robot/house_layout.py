"""Planta da casa inteligente (metros, frame "map"; o robô nasce em 0,0).

Mesmos números de backend/.../service/HouseLayoutService.java
(o teste test_house_layout.py confere se os dois continuam iguais).
Este módulo também gera o mundo do Gazebo (ver generate_world.py).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Room:
    id: str
    name: str
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    target_x: float
    target_y: float

    def contains(self, x: float, y: float) -> bool:
        return self.min_x <= x <= self.max_x and self.min_y <= y <= self.max_y


@dataclass(frozen=True)
class Wall:
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True)
class Furniture:
    name: str
    room_id: str
    x: float
    y: float
    size_x: float
    size_y: float
    height: float


WALL_HEIGHT = 1.0
WALL_THICKNESS = 0.15
DOCK = (0.0, 0.0)

ROOMS: tuple[Room, ...] = (
    Room("sala", "Sala de estar", -2.0, -3.0, 3.0, 1.0, 1.5, -1.5),
    Room("cozinha", "Cozinha", 3.0, -3.0, 8.0, 1.0, 5.5, -1.0),
    Room("quarto", "Quarto", -2.0, 1.0, 3.0, 5.0, 0.6, 3.0),
    Room("banheiro", "Banheiro", 3.0, 1.0, 5.5, 5.0, 4.2, 3.0),
    Room("escritorio", "Escritório", 5.5, 1.0, 8.0, 5.0, 6.9, 3.0),
)

WALLS: tuple[Wall, ...] = (
    # externas
    Wall(-2.0, -3.0, 8.0, -3.0),
    Wall(8.0, -3.0, 8.0, 5.0),
    Wall(8.0, 5.0, -2.0, 5.0),
    Wall(-2.0, 5.0, -2.0, -3.0),
    # y = 1 (portas: sala-quarto x 0..1.2 | cozinha-banheiro x 3.6..4.8 | cozinha-escritório x 6.4..7.6)
    Wall(-2.0, 1.0, 0.0, 1.0),
    Wall(1.2, 1.0, 3.0, 1.0),
    Wall(3.0, 1.0, 3.6, 1.0),
    Wall(4.8, 1.0, 6.4, 1.0),
    Wall(7.6, 1.0, 8.0, 1.0),
    # x = 3 (porta sala-cozinha y -1.6..-0.4; quarto-banheiro fechada)
    Wall(3.0, -3.0, 3.0, -1.6),
    Wall(3.0, -0.4, 3.0, 1.0),
    Wall(3.0, 1.0, 3.0, 5.0),
    # x = 5.5 (banheiro-escritório fechada)
    Wall(5.5, 1.0, 5.5, 5.0),
)

FURNITURE: tuple[Furniture, ...] = (
    Furniture("Sofá", "sala", -1.2, -2.4, 1.4, 0.7, 0.8),
    Furniture("Rack da TV", "sala", -1.0, 0.7, 1.4, 0.4, 0.5),
    Furniture("Mesa", "cozinha", 6.6, -1.8, 1.2, 0.8, 0.75),
    Furniture("Bancada", "cozinha", 5.5, -2.7, 2.6, 0.5, 0.9),
    Furniture("Cama", "quarto", -0.8, 3.8, 1.6, 2.0, 0.5),
    Furniture("Pia", "banheiro", 4.9, 4.6, 0.8, 0.5, 0.85),
    Furniture("Escrivaninha", "escritorio", 7.3, 4.4, 1.2, 0.6, 0.75),
)

PATROL_ROUTE: tuple[str, ...] = (
    "quarto", "sala", "cozinha", "banheiro", "cozinha", "escritorio", "cozinha", "sala",
)


def find_room(room_id: Optional[str]) -> Optional[Room]:
    if not room_id:
        return None
    key = room_id.strip().lower()
    return next((room for room in ROOMS if room.id == key), None)


def room_at(x: float, y: float) -> Optional[Room]:
    return next((room for room in ROOMS if room.contains(x, y)), None)


def patrol_targets() -> list[tuple[str, float, float]]:
    """Rota de patrulha como lista (cômodo, x, y)."""
    return [(room.id, room.target_x, room.target_y)
            for room in (find_room(room_id) for room_id in PATROL_ROUTE) if room]
