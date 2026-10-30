import re
from pathlib import Path

from amparo_robot.house_layout import FURNITURE, ROOMS, WALLS, find_room, patrol_targets, room_at

JAVA = (Path(__file__).resolve().parents[3] / "backend" / "src" / "main" / "java" / "com" / "assistmob"
        / "service" / "HouseLayoutService.java")


def test_rooms_lookup():
    assert room_at(0.0, 0.0).id == "sala"  # o robô nasce na sala
    assert room_at(6.0, 3.0).id == "escritorio"
    assert find_room(" Quarto ").name == "Quarto"
    assert room_at(20.0, 20.0) is None


def test_room_targets_are_inside_their_rooms():
    for room in ROOMS:
        assert room.contains(room.target_x, room.target_y), room.id


def test_targets_are_not_inside_furniture():
    for room in ROOMS:
        for f in FURNITURE:
            inside = (abs(room.target_x - f.x) < f.size_x / 2 + 0.25 and
                      abs(room.target_y - f.y) < f.size_y / 2 + 0.25)
            assert not inside, (room.id, f.name)


def test_patrol_route_resolves():
    assert len(patrol_targets()) == 8


def test_same_layout_as_backend():
    if not JAVA.exists():
        return
    source = JAVA.read_text(encoding="utf-8")
    java_rooms = re.findall(r'new Room\("(\w+)", "[^"]+", ([-\d., ]+)\)', source)
    py_rooms = {r.id: (r.min_x, r.min_y, r.max_x, r.max_y, r.target_x, r.target_y) for r in ROOMS}
    assert len(java_rooms) == len(ROOMS)
    for room_id, numbers in java_rooms:
        assert tuple(float(n) for n in numbers.split(",")) == py_rooms[room_id]
    java_walls = re.findall(r"new Wall\(([-\d., ]+)\)", source)
    assert [tuple(float(n) for n in w.split(",")) for w in java_walls] == [(w.x1, w.y1, w.x2, w.y2) for w in WALLS]
    java_furniture = re.findall(r'new Furniture\("[^"]+", "(\w+)", ([-\d., ]+)\)', source)
    assert [(rid, tuple(float(n) for n in nums.split(","))) for rid, nums in java_furniture] == \
        [(f.room_id, (f.x, f.y, f.size_x, f.size_y, f.height)) for f in FURNITURE]
