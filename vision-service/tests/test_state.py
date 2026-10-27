from app.state import SignalSequenceTracker


def test_confirms_only_after_two_stage_sequence() -> None:
    tracker = SignalSequenceTracker(stable_frames=2)

    first = tracker.update("session-123", "OPEN_PALM_THUMB_TUCKED", now=1.0)
    armed = tracker.update("session-123", "OPEN_PALM_THUMB_TUCKED", now=1.1)
    transition = tracker.update("session-123", "THUMB_TRAPPED", now=1.2)
    confirmed = tracker.update("session-123", "THUMB_TRAPPED", now=1.3)

    assert first.confirmed is False
    assert armed.state == "ARMED"
    assert transition.confirmed is False
    assert confirmed.confirmed is True
    assert confirmed.state == "CONFIRMED"


def test_does_not_confirm_fist_without_open_palm_stage() -> None:
    tracker = SignalSequenceTracker(stable_frames=2)

    tracker.update("session-456", "THUMB_TRAPPED", now=1.0)
    result = tracker.update("session-456", "THUMB_TRAPPED", now=1.1)

    assert result.confirmed is False
    assert result.state == "IDLE"
