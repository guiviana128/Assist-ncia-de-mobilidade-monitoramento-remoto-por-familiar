import math

from amparo_robot.scan_pipeline import sector_of, summarize


def test_ignores_invalid_readings_and_finds_nearest():
    ranges = [float("inf"), 0.05, 2.0, 0.8, float("nan"), 3.0]
    s = summarize(ranges, angle_min=0.0, angle_increment=math.radians(60), range_min=0.12, range_max=3.5)
    assert s.nearest_m == 0.8
    assert s.sector == "trás"  # leitura de índice 3 = 180°
    assert s.front_clear


def test_front_blocked():
    ranges = [0.3] + [2.0] * 359
    s = summarize(ranges, 0.0, math.radians(1), 0.12, 3.5)
    assert s.sector == "frente" and not s.front_clear


def test_empty_scan_is_free():
    s = summarize([float("inf")] * 10, 0.0, 0.1, 0.12, 3.5)
    assert s.nearest_m is None and s.sector == "livre" and s.front_clear


def test_sectors():
    assert sector_of(math.radians(90)) == "esquerda"
    assert sector_of(math.radians(-90)) == "direita"
    assert sector_of(math.radians(350)) == "frente"
