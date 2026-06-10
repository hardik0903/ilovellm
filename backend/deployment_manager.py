import sqlite3
import uuid
from datetime import datetime

DB_PATH = "deployments.db"

def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_deployments_db():
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS deployments (
                id TEXT PRIMARY KEY,
                artifact_id TEXT NOT NULL,
                endpoint_token TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()

# Initialize immediately
init_deployments_db()

def create_deployment(artifact_id: str) -> str:
    """Creates a deployment and returns the secure endpoint token."""
    dep_id = str(uuid.uuid4())
    token = f"pk_{uuid.uuid4().hex[:16]}"
    created_at = datetime.utcnow().isoformat()
    
    with _get_conn() as conn:
        conn.execute("""
            INSERT INTO deployments (id, artifact_id, endpoint_token, status, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (dep_id, artifact_id, token, "active", created_at))
        conn.commit()
        
    return token

def get_artifact_for_token(token: str):
    """Returns the artifact_id for a given token, or None if invalid/inactive."""
    with _get_conn() as conn:
        cur = conn.execute("SELECT artifact_id FROM deployments WHERE endpoint_token = ? AND status = 'active'", (token,))
        row = cur.fetchone()
        if row:
            return row["artifact_id"]
    return None
