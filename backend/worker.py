import time
import os
import pandas as pd
import traceback
from queue_manager import claim_next_job, update_job_status
from finetuner import (
    train_small_classifier,
    train_extractor,
    build_rag_pipeline,
    prepare_dataset,
    _train_worker
)

def process_job(job):
    job_id = job["job_id"]
    plan = job["plan"]
    exec_mode = plan.get("execution_mode", "no_train")
    
    dataset_path = job["dataset_path"]
    input_col = job["input_col"]
    output_col = job["output_col"]
    
    update_job_status(job_id, "running", f"Starting execution mode: {exec_mode}")
    
    # Base output dir
    base_out = f"./models/{exec_mode}_{job_id[:8]}"
    
    try:
        if exec_mode == "classifier":
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            res = train_small_classifier(df, input_col, output_col, base_out)
            update_job_status(job_id, "completed", "Classifier trained successfully.", base_out)
            
        elif exec_mode == "extractor":
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            res = train_extractor(df, input_col, output_col, base_out)
            update_job_status(job_id, "completed", "Schema extractor built successfully.", base_out)
            
        elif exec_mode == "rag":
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            res = build_rag_pipeline(df, input_col, output_col, base_out)
            update_job_status(job_id, "completed", "RAG vector database indexed successfully.", base_out)
            
        elif exec_mode == "lora_sft":
            # For Phase 5 Safety budgets, we enforce max rows based on budget_limits
            budget = plan.get("budget_limits", {})
            max_rows = budget.get("max_rows", 10000)
            epochs = budget.get("max_epochs", 3)
            
            df = pd.read_csv(dataset_path) if dataset_path.endswith('.csv') else pd.read_json(dataset_path, lines=True)
            if len(df) > max_rows:
                df = df.head(max_rows)
                # save trimmed df to a temp file
                trimmed_path = dataset_path + ".trimmed.jsonl"
                df.to_json(trimmed_path, orient='records', lines=True)
                dataset_path = trimmed_path
                update_job_status(job_id, "running", f"Dataset truncated to budget maximum of {max_rows} rows.")
                
            dataset = prepare_dataset(dataset_path, input_col, output_col, target_format='chatml')
            
            update_job_status(job_id, "running", f"Dataset prepared. Starting SFTTrainer. (Logs are tracked internally)")
            
            # Since SFTTrainer logs to a global state in the old code, we will just call it synchronously here
            # In a real production setup, we'd inject a callback that calls update_job_status with the loss
            _train_worker(
                dataset=dataset,
                model_id="HuggingFaceTB/SmolLM-360M-Instruct", # using smaller model for speed
                batch_size=1,
                lr=2e-4,
                epochs=epochs,
                lora_rank=8,
                output_dir=base_out,
                use_eval=True
            )
            # if _train_worker completes without exception (it handles its own internally, but let's assume it populates global state)
            from finetuner import training_state
            if training_state.get("error"):
                raise Exception(training_state["error"])
                
            update_job_status(job_id, "completed", "LoRA SFT training completed.", base_out)
            
        elif exec_mode == "no_train" or exec_mode == "browser":
            update_job_status(job_id, "completed", f"Mode {exec_mode} does not require background execution.", base_out)
            
        else:
            raise ValueError(f"Unknown execution mode: {exec_mode}")
            
    except Exception as e:
        err_msg = str(e) + "\n" + traceback.format_exc()
        update_job_status(job_id, "failed", f"Execution failed:\n{err_msg}")
        
    finally:
        # Cleanup temp dataset file
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
