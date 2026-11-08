from app.outbox import Outbox

def test_pending_metadata_survives_restart_and_duplicate_enqueue(tmp_path):
    path=tmp_path/'events.sqlite'
    queue=Outbox(path)
    queue.add({'eventId':'event-1','deviceId':'device-1'})
    queue.add({'eventId':'event-1','deviceId':'device-1'})
    queue.db.close()
    resumed=Outbox(path)
    assert len(resumed.pending())==1
    resumed.delivered('event-1')
    resumed.db.close()
    reopened=Outbox(path)
    assert reopened.pending()==[]
    reopened.db.close()
