from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic


@dataclass
class SequenceResult:
    progress: float
    confirmed: bool
    state: str


@dataclass
class _SessionState:
    stage_one_frames: int = 0
    stage_two_frames: int = 0
    armed_until: float = 0.0
    cooldown_until: float = 0.0
    last_seen: float = 0.0


class SignalSequenceTracker:
    def __init__(
        self,
        stable_frames: int = 2,
        transition_seconds: float = 4.0,
        cooldown_seconds: float = 8.0,
    ) -> None:
        self._stable_frames = stable_frames
        self._transition_seconds = transition_seconds
        self._cooldown_seconds = cooldown_seconds
        self._sessions: dict[str, _SessionState] = {}
        self._lock = Lock()

    def update(self, session_id: str, phase: str, now: float | None = None) -> SequenceResult:
        timestamp = monotonic() if now is None else now
        with self._lock:
            self._cleanup(timestamp)
            state = self._sessions.setdefault(session_id, _SessionState())
            state.last_seen = timestamp

            if timestamp < state.cooldown_until:
                return SequenceResult(1.0, False, "COOLDOWN")

            if phase == "OPEN_PALM_THUMB_TUCKED":
                state.stage_one_frames += 1
                state.stage_two_frames = 0
                if state.stage_one_frames >= self._stable_frames:
                    state.armed_until = timestamp + self._transition_seconds
                    return SequenceResult(0.5, False, "ARMED")
                return SequenceResult(0.25, False, "OBSERVING_STAGE_ONE")

            if phase == "THUMB_TRAPPED" and timestamp <= state.armed_until:
                state.stage_two_frames += 1
                if state.stage_two_frames >= self._stable_frames:
                    state.stage_one_frames = 0
                    state.stage_two_frames = 0
                    state.armed_until = 0.0
                    state.cooldown_until = timestamp + self._cooldown_seconds
                    return SequenceResult(1.0, True, "CONFIRMED")
                return SequenceResult(0.75, False, "OBSERVING_STAGE_TWO")

            if timestamp > state.armed_until:
                state.stage_one_frames = 0
                state.stage_two_frames = 0
                state.armed_until = 0.0

            return SequenceResult(0.0, False, "IDLE")

    def _cleanup(self, now: float) -> None:
        expired = [
            session_id
            for session_id, state in self._sessions.items()
            if now - state.last_seen > 120.0
        ]
        for session_id in expired:
            del self._sessions[session_id]
