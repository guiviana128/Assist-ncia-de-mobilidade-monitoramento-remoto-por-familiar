from __future__ import annotations

import math
from threading import Lock
from typing import Sequence

import cv2
import mediapipe as mp
import numpy as np

from .models import BoundingBox
from .state import SignalSequenceTracker


class SignalForHelpDetector:
    def __init__(self) -> None:
        self._hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            model_complexity=1,
            min_detection_confidence=0.65,
            min_tracking_confidence=0.60,
        )
        self._sequence = SignalSequenceTracker()
        self._inference_lock = Lock()

    def analyze(self, image_bgr: np.ndarray, session_id: str) -> dict:
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        with self._inference_lock:
            result = self._hands.process(rgb)

        if not result.multi_hand_landmarks:
            sequence = self._sequence.update(session_id, "NONE")
            return {
                "hand_detected": False,
                "hand_count": 0,
                "handedness": None,
                "bounding_box": None,
                "phase": "NONE",
                "confidence": 0.0,
                "sequence": sequence,
            }

        hand_landmarks = result.multi_hand_landmarks[0]
        landmarks = [(point.x, point.y, point.z) for point in hand_landmarks.landmark]
        handedness = None
        detector_score = 0.0
        if result.multi_handedness:
            classification = result.multi_handedness[0].classification[0]
            handedness = classification.label
            detector_score = float(classification.score)

        phase, shape_score = self._classify(landmarks)
        sequence = self._sequence.update(session_id, phase)

        xs = [point[0] for point in landmarks]
        ys = [point[1] for point in landmarks]
        padding = 0.03
        min_x = max(0.0, min(xs) - padding)
        min_y = max(0.0, min(ys) - padding)
        max_x = min(1.0, max(xs) + padding)
        max_y = min(1.0, max(ys) + padding)

        return {
            "hand_detected": True,
            "hand_count": len(result.multi_hand_landmarks),
            "handedness": handedness,
            "bounding_box": BoundingBox(
                x=min_x,
                y=min_y,
                width=max_x - min_x,
                height=max_y - min_y,
            ),
            "phase": phase,
            "confidence": round(min(1.0, 0.55 * shape_score + 0.45 * detector_score), 4),
            "sequence": sequence,
        }

    def _classify(self, landmarks: Sequence[tuple[float, float, float]]) -> tuple[str, float]:
        finger_indices = ((5, 6, 8), (9, 10, 12), (13, 14, 16), (17, 18, 20))
        extended = 0
        folded = 0

        for mcp_index, pip_index, tip_index in finger_indices:
            angle = self._angle(
                landmarks[mcp_index],
                landmarks[pip_index],
                landmarks[tip_index],
            )
            tip_to_wrist = self._distance(landmarks[tip_index], landmarks[0])
            pip_to_wrist = self._distance(landmarks[pip_index], landmarks[0])
            if angle >= 150.0 and tip_to_wrist > pip_to_wrist:
                extended += 1
            if angle <= 125.0 or tip_to_wrist <= pip_to_wrist * 1.05:
                folded += 1

        palm_center = tuple(
            sum(landmarks[index][axis] for index in (0, 5, 9, 13, 17)) / 5.0
            for axis in range(3)
        )
        palm_width = max(self._distance(landmarks[5], landmarks[17]), 1e-6)
        thumb_tip_to_center = self._distance(landmarks[4], palm_center)
        thumb_tip_to_index = self._distance(landmarks[4], landmarks[5])
        thumb_tucked = (
            thumb_tip_to_center <= palm_width * 0.78
            and thumb_tip_to_index <= palm_width * 0.92
        )

        if thumb_tucked and extended >= 3:
            return "OPEN_PALM_THUMB_TUCKED", (extended + 1) / 5.0
        if thumb_tucked and folded >= 3:
            return "THUMB_TRAPPED", (folded + 1) / 5.0
        return "NONE", max(extended, folded) / 5.0

    def _angle(
        self,
        first: tuple[float, float, float],
        middle: tuple[float, float, float],
        last: tuple[float, float, float],
    ) -> float:
        vector_a = np.array(first) - np.array(middle)
        vector_b = np.array(last) - np.array(middle)
        denominator = np.linalg.norm(vector_a) * np.linalg.norm(vector_b)
        if denominator == 0:
            return 0.0
        cosine = float(np.clip(np.dot(vector_a, vector_b) / denominator, -1.0, 1.0))
        return math.degrees(math.acos(cosine))

    def _distance(
        self,
        first: tuple[float, float, float],
        second: tuple[float, float, float],
    ) -> float:
        return float(np.linalg.norm(np.array(first) - np.array(second)))
