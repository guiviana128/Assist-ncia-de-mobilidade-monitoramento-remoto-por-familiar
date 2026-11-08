from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np
import pytest

from app.detector import SignalForHelpDetector
from app.state import SignalSequenceTracker


def make_detector(world):
    detector = object.__new__(SignalForHelpDetector)
    from threading import Lock
    detector._inference_lock = Lock()
    detector._sequence = SignalSequenceTracker()
    normalized = [SimpleNamespace(x=0.25, y=0.5, z=0.0) for _ in range(21)]
    detector._hands = SimpleNamespace(process=Mock(return_value=SimpleNamespace(
        multi_hand_landmarks=[SimpleNamespace(landmark=normalized)],
        multi_hand_world_landmarks=world,
        multi_handedness=None,
    )))
    detector._classify = Mock(return_value=("OPEN_PALM_THUMB_TUCKED", 0.8))
    return detector


@pytest.mark.parametrize("height,width", [(480, 640), (640, 480), (720, 1280)])
def test_classification_uses_world_geometry_independent_of_image_shape(height, width):
    points = [SimpleNamespace(x=i * 0.001, y=i * 0.002, z=-i * 0.003)
              for i in range(21)]
    detector = make_detector([SimpleNamespace(landmark=points)])
    result = detector.analyze(np.zeros((height, width, 3), dtype=np.uint8), "session-one")
    detector._classify.assert_called_once_with([(p.x, p.y, p.z) for p in points])
    # Display coordinates must still come from image landmarks.
    assert result["bounding_box"].x == pytest.approx(0.22)
    assert result["bounding_box"].y == pytest.approx(0.47)


@pytest.mark.parametrize("world", [None, []])
def test_missing_world_geometry_does_not_classify_or_arm_sequence(world):
    detector = make_detector(world)
    for _ in range(3):
        result = detector.analyze(np.zeros((480, 640, 3), dtype=np.uint8), "session-one")
    detector._classify.assert_not_called()
    assert result["hand_detected"] is True
    assert result["phase"] == "NONE"
    assert result["confidence"] == 0.0
    assert result["sequence"].confirmed is False
    assert result["sequence"].state == "IDLE"
