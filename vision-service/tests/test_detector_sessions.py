from types import SimpleNamespace
import numpy as np
from app.detector import SignalForHelpDetector
from app.state import SignalSequenceTracker
from threading import Lock

def test_missing_hand_resets_the_actual_handedness_sequence():
    detector=object.__new__(SignalForHelpDetector)
    detector._sequence=SignalSequenceTracker()
    detector._inference_lock=Lock()
    detector._hands=SimpleNamespace(process=lambda _:SimpleNamespace(multi_hand_landmarks=None))
    detector._sequence.update('session-a:Left','OPEN_PALM_THUMB_TUCKED')
    detector._sequence.update('session-a:Left','OPEN_PALM_THUMB_TUCKED')
    detector._sequence.update('session-a:Left','THUMB_TRAPPED')
    detector.analyze(np.zeros((32,32,3),dtype=np.uint8),'session-a')
    result=detector._sequence.update('session-a:Left','THUMB_TRAPPED')
    assert not result.confirmed
