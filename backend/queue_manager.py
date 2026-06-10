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
    conn.commit()
    conn.close()

def enqueue_job(dataset_path: str, input_col: str, output_col: str, plan: Dict[str, Any]) -> str:
    job_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO jobs (job_id, dataset_path, input_col, output_col, plan_json, status, logs, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

def claim_next_job() -> Optional[Dict[str, Any]]:
    """Atomically claims a queued job for a worker."""
    now = datetime.datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH, isolation_level='EXCLUSIVE')
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT job_id, dataset_path, input_col, output_col, plan_json 
        FROM jobs 
        WHERE status = 'queued' 
        ORDER BY created_at ASC 
        LIMIT 1
    ''')
    row = cursor.fetchone()
    
    if not row:
        conn.commit()
        conn.close()
        return None
        
    job_id = row[0]
    cursor.execute('''
        UPDATE jobs 
        SET status = 'running', updated_at = ?, logs = logs || 'Job claimed by worker.\n'
        WHERE job_id = ?
    ''', (now, job_id))
    
    conn.commit()
    conn.close()
    
    return {
        "job_id": job_id,
        "dataset_path": row[1],
        "input_col": row[2],
        "output_col": row[3],
        "plan": json.loads(row[4])
    }

# Initialize on import
init_db()
