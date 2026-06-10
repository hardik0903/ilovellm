import sqlite3
import json
import uuid
import datetime
from typing import Dict, Any, Optional

DB_PATH = "jobs.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            job_id TEXT PRIMARY KEY,
            dataset_path TEXT,
            input_col TEXT,
            output_col TEXT,
            plan_json TEXT,
            status TEXT,
            logs TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            output_dir TEXT
        )
    ''')
    
    # Safely migrate new columns for Phase 8
    try:
        cursor.execute("ALTER TABLE jobs ADD COLUMN started_at TIMESTAMP")
        cursor.execute("ALTER TABLE jobs ADD COLUMN last_heartbeat TIMESTAMP")
        cursor.execute("ALTER TABLE jobs ADD COLUMN attempt_count INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE jobs ADD COLUMN error_message TEXT")
        cursor.execute("ALTER TABLE jobs ADD COLUMN artifact_type TEXT")
    except sqlite3.OperationalError:
        pass # Columns already exist
        
    # Artifact Registry Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS artifacts (
            id TEXT PRIMARY KEY,
            job_id TEXT,
            artifact_type TEXT,
            artifact_path TEXT,
            version TEXT,
            created_at TIMESTAMP,
            metadata_json TEXT,
            metrics_json TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

def enqueue_job(dataset_path: str, input_col: str, output_col: str, plan: Dict[str, Any]) -> str:
    job_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO jobs (job_id, dataset_path, input_col, output_col, plan_json, status, logs, created_at, updated_at, attempt_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ''', (job_id, dataset_path, input_col, output_col, json.dumps(plan), 'queued', 'Job created and queued.\n', now, now))
    conn.commit()
    conn.close()
    return job_id

def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT status, logs, output_dir, plan_json FROM jobs WHERE job_id = ?', (job_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    return {
        "job_id": job_id,
        "status": row[0],
        "logs": row[1],
        "output_dir": row[2],
        "plan": json.loads(row[3]) if row[3] else {}
    }

def update_job_status(job_id: str, status: str, log_append: str = None, output_dir: str = None):
    now = datetime.datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if log_append:
        cursor.execute('''
            UPDATE jobs 
            SET status = ?, updated_at = ?, logs = logs || ? 
            WHERE job_id = ?
        ''', (status, now, log_append + '\n', job_id))
    else:
        cursor.execute('''
            UPDATE jobs 
            SET status = ?, updated_at = ?
            WHERE job_id = ?
        ''', (status, now, job_id))
        
    if output_dir:
        cursor.execute('UPDATE jobs SET output_dir = ? WHERE job_id = ?', (output_dir, job_id))
        
    conn.commit()
    conn.close()

def get_artifact_by_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, artifact_type, artifact_path, metadata_json, metrics_json FROM artifacts WHERE job_id = ?', (job_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "artifact_type": row[1],
        "artifact_path": row[2],
        "metadata": json.loads(row[3]) if row[3] else {},
        "metrics": json.loads(row[4]) if row[4] else {}
    }

def heartbeat_job(job_id: str):
    now = datetime.datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE jobs SET last_heartbeat = ?, updated_at = ? WHERE job_id = ?', (now, now, job_id))
    conn.commit()
    conn.close()

def register_artifact(job_id: str, artifact_type: str, artifact_path: str, metadata: Dict, metrics: Dict) -> str:
    art_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO artifacts (id, job_id, artifact_type, artifact_path, version, created_at, metadata_json, metrics_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (art_id, job_id, artifact_type, artifact_path, "v1", now, json.dumps(metadata), json.dumps(metrics)))
    
    cursor.execute('UPDATE jobs SET artifact_type = ? WHERE job_id = ?', (artifact_type, job_id))
    conn.commit()
    conn.close()
    return art_id

def get_all_artifacts():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, job_id, artifact_type, artifact_path, version, created_at, metadata_json, metrics_json FROM artifacts ORDER BY created_at DESC')
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        results.append({
            "id": row[0],
            "job_id": row[1],
            "artifact_type": row[2],
            "artifact_path": row[3],
            "version": row[4],
            "created_at": row[5],
            "metadata": json.loads(row[6]) if row[6] else {},
            "metrics": json.loads(row[7]) if row[7] else {}
        })
    return results

def fail_job(job_id: str, error_message: str):
    now = datetime.datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE jobs 
        SET status = 'failed', updated_at = ?, error_message = ?, logs = logs || ? 
        WHERE job_id = ?
    ''', (now, error_message, f"\nFAILED: {error_message}\n", job_id))
    conn.commit()
    conn.close()

def claim_next_job() -> Optional[Dict[str, Any]]:
    """Atomically claims a queued job for a worker, handling leased timeouts."""
    now_obj = datetime.datetime.now()
    now = now_obj.isoformat()
    timeout_threshold = (now_obj - datetime.timedelta(minutes=2)).isoformat()
    
    conn = sqlite3.connect(DB_PATH, isolation_level='EXCLUSIVE')
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT job_id, dataset_path, input_col, output_col, plan_json, attempt_count 
        FROM jobs 
        WHERE status = 'queued' OR (status = 'running' AND last_heartbeat < ?)
        ORDER BY created_at ASC 
        LIMIT 1
    ''', (timeout_threshold,))
    row = cursor.fetchone()
    
    if not row:
        conn.commit()
        conn.close()
        return None
        
    job_id, dataset_path, input_col, output_col, plan_json, attempt_count = row
    attempt_count = attempt_count or 0
    
    if attempt_count >= 3:
        cursor.execute("UPDATE jobs SET status = 'failed', error_message = 'Job failed after 3 attempts' WHERE job_id = ?", (job_id,))
        conn.commit()
        conn.close()
        return None
        
    cursor.execute('''
        UPDATE jobs 
        SET status = 'running', updated_at = ?, started_at = ?, last_heartbeat = ?, attempt_count = ?, logs = logs || 'Job claimed by worker (Attempt ' || ? || ').\n'
        WHERE job_id = ?
    ''', (now, now, now, attempt_count + 1, attempt_count + 1, job_id))
    
    conn.commit()
    conn.close()
    
    return {
        "job_id": job_id,
        "dataset_path": dataset_path,
        "input_col": input_col,
        "output_col": output_col,
        "plan": json.loads(plan_json)
    }
    
    return {
        "job_id": job_id,
        "dataset_path": row[1],
        "input_col": row[2],
        "output_col": row[3],
        "plan": json.loads(row[4])
    }

# Initialize on import
init_db()
