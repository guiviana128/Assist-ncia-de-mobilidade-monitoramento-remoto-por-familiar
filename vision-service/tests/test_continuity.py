from app.state import SignalSequenceTracker

def test_interrupted_first_stage_requires_consecutive_frames():
    tracker = SignalSequenceTracker()
    tracker.update('camera-123', 'OPEN_PALM_THUMB_TUCKED', now=1)
    tracker.update('camera-123', 'NONE', now=1.1)
    result = tracker.update('camera-123', 'OPEN_PALM_THUMB_TUCKED', now=1.2)
    assert result.state == 'OBSERVING_STAGE_ONE'

def test_interrupted_closing_stage_requires_consecutive_frames():
    tracker = SignalSequenceTracker()
    tracker.update('camera-123', 'OPEN_PALM_THUMB_TUCKED', now=1)
    tracker.update('camera-123', 'OPEN_PALM_THUMB_TUCKED', now=1.1)
    tracker.update('camera-123', 'THUMB_TRAPPED', now=1.2)
    tracker.update('camera-123', 'NONE', now=1.3)
    result = tracker.update('camera-123', 'THUMB_TRAPPED', now=1.4)
    assert not result.confirmed
