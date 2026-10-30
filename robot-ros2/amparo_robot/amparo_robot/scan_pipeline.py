"""Pipeline do LiDAR em estilo funcional (paradigma funcional, ver docs/ARQUITETURA.md).

Funções puras, sem estado e sem efeitos colaterais: recebem as leituras do /scan e devolvem
um resumo imutável. São compostas em uma sequência filtro -> mapeamento -> redução,
o que facilita testar sem ROS (test/test_scan_pipeline.py).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from functools import reduce
from typing import Callable, Iterable, Optional, Sequence

Reading = tuple[float, float]  # (ângulo em rad, distância em m)


@dataclass(frozen=True)
class ObstacleSummary:
    nearest_m: Optional[float]
    nearest_angle_rad: Optional[float]
    front_clear: bool
    sector: str  # "frente", "esquerda", "direita", "trás" ou "livre"


def to_readings(ranges: Sequence[float], angle_min: float, angle_increment: float) -> list[Reading]:
    return [(angle_min + i * angle_increment, r) for i, r in enumerate(ranges)]


def valid(range_min: float, range_max: float) -> Callable[[Reading], bool]:
    return lambda reading: math.isfinite(reading[1]) and range_min <= reading[1] <= range_max


def normalize_angle(angle: float) -> float:
    return math.atan2(math.sin(angle), math.cos(angle))


def sector_of(angle: float) -> str:
    a = math.degrees(normalize_angle(angle))
    if -30 <= a <= 30:
        return "frente"
    if 30 < a <= 150:
        return "esquerda"
    if -150 <= a < -30:
        return "direita"
    return "trás"


def closest(readings: Iterable[Reading]) -> Optional[Reading]:
    return reduce(lambda best, r: r if best is None or r[1] < best[1] else best, readings, None)


def summarize(ranges: Sequence[float], angle_min: float, angle_increment: float,
              range_min: float, range_max: float, front_clearance_m: float = 0.5) -> ObstacleSummary:
    readings = list(filter(valid(range_min, range_max), to_readings(ranges, angle_min, angle_increment)))
    nearest = closest(readings)
    front_min = closest(r for r in readings if sector_of(r[0]) == "frente")
    front_clear = front_min is None or front_min[1] > front_clearance_m
    if nearest is None:
        return ObstacleSummary(None, None, True, "livre")
    return ObstacleSummary(round(nearest[1], 3), normalize_angle(nearest[0]), front_clear, sector_of(nearest[0]))
