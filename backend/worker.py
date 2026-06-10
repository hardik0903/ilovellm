import time
import os
import pandas as pd
import traceback
from queue_manager import claim_next_job, update_job_status, fail_job, heartbeat_job, register_artifact
from finetuner import (
    train_small_classifier,
    train_extractor,
    build_rag_pipeline,
    prepare_dataset,
    execute_lora_sft
)

def process_job(job):
    job_id = job["job_id"]
    plan = job["plan"]
    exec_mode = plan.get("execution_mode", "no_train")
    
    dataset_path = job["dataset_path"]
    input_col = job["input_col"]
    output_col = job["output_col"]
    
    update_job_status(job_id, "running", f"Starting execution mode: {exec_mode}")
    
    def heartbeat():
        heartbeat_job(job_id)
        
    heartbeat() # Initial heartbeat
    
    base_out = f"./models/{exec_mode}_{job_id[:8]}"
    
    try:
        if exec_mode == "classifier":
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            zip_path, metadata, metrics = train_small_classifier(df, input_col, output_col, base_out, heartbeat_fn=heartbeat)
            register_artifact(job_id, exec_mode, zip_path, metadata, metrics)
            update_job_status(job_id, "completed", "Classifier trained successfully.", base_out)
            
        elif exec_mode == "extractor":
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            zip_path, metadata, metrics = train_extractor(df, input_col, output_col, base_out, heartbeat_fn=heartbeat)
            register_artifact(job_id, exec_mode, zip_path, metadata, metrics)
            update_job_status(job_id, "completed", "Schema extractor built successfully.", base_out)
            
        elif exec_mode == "rag":
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            zip_path, metadata, metrics = build_rag_pipeline(df, input_col, output_col, base_out, heartbeat_fn=heartbeat)
            register_artifact(job_id, exec_mode, zip_path, metadata, metrics)
            update_job_status(job_id, "completed", "RAG vector database indexed successfully.", base_out)
            
        elif exec_mode == "lora_sft":
            budget = plan.get("budget_limits", {})
            max_rows = budget.get("max_rows", 10000)
            epochs = budget.get("max_epochs", 3)
            
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            if len(df) > max_rows:
                df = df.head(max_rows)
                trimmed_path = dataset_path + ".trimmed.jsonl"
                df.to_json(trimmed_path, orient='records', lines=True)
                dataset_path = trimmed_path
                update_job_status(job_id, "running", f"Dataset truncated to budget maximum of {max_rows} rows.")
                
            dataset = prepare_dataset(dataset_path, input_col, output_col, target_format='chatml')
            
            update_job_status(job_id, "running", f"Dataset prepared. Starting SFTTrainer. (Logs are tracked internally)")
            
            zip_path, metadata, metrics = execute_lora_sft(
                dataset=dataset,
                output_dir=base_out,
                heartbeat_fn=heartbeat,
                batch_size=1,
                lr=2e-4,
                epochs=epochs,
                lora_rank=8
            )
                
            register_artifact(job_id, exec_mode, zip_path, metadata, metrics)
            update_job_status(job_id, "completed", "LoRA SFT training completed.", base_out)
            
        elif exec_mode == "no_train" or exec_mode == "manual_review":
            update_job_status(job_id, "completed", f"Mode {exec_mode} does not require background execution.", base_out)
            
        else:
            raise ValueError(f"Unknown execution mode: {exec_mode}")
            
    except Exception as e:
        err_msg = str(e) + "\n" + traceback.format_exc()
        fail_job(job_id, err_msg)
        
    finally:
        if os.path.exists(dataset_path) and dataset_path.startswith("temp_"):
            try:
                os.remove(dataset_path)
            except:
                pass

def worker_loop():
    print("Worker started. Waiting for jobs...")
    while True:
        try:
            job = claim_next_job()
            if job:
                print(f"Claimed job {job['job_id']}. Processing...")
                process_job(job)
                print(f"Finished job {job['job_id']}.")
            else:
                time.sleep(2)
        except Exception as e:
            print(f"Worker loop error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    worker_loop()
