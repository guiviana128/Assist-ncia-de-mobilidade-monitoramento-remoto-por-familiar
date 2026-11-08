"""Durable metadata delivery. No images or landmarks are persisted."""
import json
import sqlite3

class Outbox:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute("CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS rejected (id TEXT PRIMARY KEY, payload TEXT NOT NULL, reason TEXT)")
    def add(self, metadata):
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO pending VALUES (?,?)", (metadata['eventId'],json.dumps(metadata)))
    def pending(self):
        return [(key,json.loads(body)) for key,body in self.db.execute("SELECT id,payload FROM pending ORDER BY rowid LIMIT 20")]
    def reject(self, key, reason):
        with self.db:
            self.db.execute("INSERT OR REPLACE INTO rejected SELECT id,payload,? FROM pending WHERE id=?", (reason,key))
            self.db.execute("DELETE FROM pending WHERE id=?", (key,))
    def delivered(self, key):
        with self.db:
            self.db.execute("DELETE FROM pending WHERE id=?", (key,))
