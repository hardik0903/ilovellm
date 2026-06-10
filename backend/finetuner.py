import os
import json
import threading
import pandas as pd
import torch
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainerCallback
from peft import LoraConfig, get_peft_model
from trl import SFTTrainer, SFTConfig

# Global state to track training progress
training_state = {
    "is_training": False,
    "current_epoch": 0,
    "total_epochs": 0,
    "current_step": 0,
    "max_steps": 0,
    "loss": 0.0,
    "loss_history": [],
    "eval_metrics": None,
    "status": "Idle",
    "error": None,
    "output_dir": None
}

class ProgressCallback(TrainerCallback):
    def on_log(self, args, state, control, logs=None, **kwargs):
        global training_state
        if logs and "loss" in logs:
            current_loss = round(logs["loss"], 4)
            training_state["loss"] = current_loss
            training_state["loss_history"].append({
                "step": state.global_step,
                "loss": current_loss
            })
            training_state["current_step"] = state.global_step
            
        if logs and "eval_loss" in logs:
            if training_state["eval_metrics"] is None:
                training_state["eval_metrics"] = {}
            training_state["eval_metrics"]["eval_loss"] = round(logs["eval_loss"], 4)

    def on_step_begin(self, args, state, control, **kwargs):
        global training_state
        training_state["current_step"] = state.global_step
        training_state["current_epoch"] = round(state.epoch or 0, 2)

    def on_train_begin(self, args, state, control, **kwargs):
        global training_state
        training_state["max_steps"] = state.max_steps
        training_state["status"] = "Training in progress..."

    def on_train_end(self, args, state, control, **kwargs):
        global training_state
        training_state["status"] = "Saving model adapters..."

def prepare_dataset(file_path: str, input_col: str, output_col: str, target_format: str = 'chatml'):
    """
    Reads a CSV or JSONL file and formats it into conversational text strings
    for the SFTTrainer.
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".csv":
        df = pd.read_csv(file_path)
    elif ext in [".json", ".jsonl"]:
        df = pd.read_json(file_path, lines=(ext==".jsonl"))
    else:
        raise ValueError("Only CSV and JSONL files are supported.")

    if input_col not in df.columns or output_col not in df.columns:
        raise ValueError(f"Columns '{input_col}' and/or '{output_col}' not found in dataset.")

    formatted_texts = []
    
    # Fill NAs
    df = df.fillna("")
    
    for _, row in df.iterrows():
        user_text = str(row[input_col])
        assistant_text = str(row[output_col])
        
        if target_format == 'chatml':
            formatted = f"<|im_start|>user\n{user_text}<|im_end|>\n<|im_start|>assistant\n{assistant_text}<|im_end|>"
        elif target_format == 'instruction-response':
            formatted = f"Instruction: {user_text}\nResponse: {assistant_text}"
        elif target_format == 'classification':
            formatted = f"Text: {user_text}\nLabel: {assistant_text}"
        else:
            # Default to chatml
            formatted = f"<|im_start|>user\n{user_text}<|im_end|>\n<|im_start|>assistant\n{assistant_text}<|im_end|>"
            
        formatted_texts.append(formatted)
        
    hf_dataset = Dataset.from_dict({"text": formatted_texts})
    return hf_dataset

def _train_worker(dataset, model_id, batch_size, lr, epochs, lora_rank, output_dir, use_eval=True):
    global training_state
    try:
        training_state["status"] = "Loading tokenizer..."
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        training_state["status"] = "Loading model to CPU (this may take a minute)..."
        # Force CPU and use float32 or bfloat16 (bfloat16 is lighter if CPU supports it, but float32 is safest)
        model = AutoModelForCausalLM.from_pretrained(
            model_id, 
            device_map="cpu", 
            torch_dtype=torch.float32
        )

        training_state["status"] = "Applying LoRA adapters..."
        peft_config = LoraConfig(
            r=lora_rank,
            lora_alpha=lora_rank * 2,
            target_modules=["q_proj", "v_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
        )
        model = get_peft_model(model, peft_config)

        # Make sure adapter weights require grad
        model.train()

        training_state["status"] = "Initializing Trainer..."
        
        # Split dataset if requested
        if use_eval and len(dataset) > 10:
            split_dataset = dataset.train_test_split(test_size=0.1)
            train_data = split_dataset['train']
            eval_data = split_dataset['test']
            eval_strategy = "epoch"
        else:
            train_data = dataset
            eval_data = None
            eval_strategy = "no"

        training_args = SFTConfig(
            output_dir=output_dir,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=4,
            learning_rate=lr,
            num_train_epochs=epochs,
            logging_steps=1, # Log frequently so the UI updates
            eval_strategy=eval_strategy,
            save_strategy="no",
            use_cpu=True,
            remove_unused_columns=False,
            dataset_text_field="text",
            max_length=512,
        )

        trainer = SFTTrainer(
            model=model,
            train_dataset=train_data,
            eval_dataset=eval_data,
            processing_class=tokenizer,
            args=training_args,
            callbacks=[ProgressCallback()]
        )

        trainer.train()
        
        # Run final eval if we have eval data
        if eval_data:
            training_state["status"] = "Running final evaluation..."
            eval_results = trainer.evaluate()
            training_state["eval_metrics"] = {k: round(v, 4) for k, v in eval_results.items() if isinstance(v, (int, float))}

        # Save final LoRA adapters
        training_state["status"] = "Saving model adapters..."
        os.makedirs(output_dir, exist_ok=True)
        trainer.model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)

        training_state["status"] = "Training Completed Successfully!"
        training_state["output_dir"] = output_dir
        training_state["is_training"] = False

    except Exception as e:
        import traceback
        training_state["error"] = str(e)
        training_state["status"] = "Failed"
        training_state["is_training"] = False
        print(f"Training error: {e}")
        traceback.print_exc()

def start_lora_training_cpu(dataset, model_id="Qwen/Qwen2.5-0.5B", batch_size=1, lr=2e-4, epochs=1, lora_rank=8, output_dir="./models/adapters/custom_lora", use_eval=True):
    global training_state
    
    if training_state["is_training"]:
        raise RuntimeError("A training job is already running.")

    # Reset state
    training_state.update({
        "is_training": True,
        "current_epoch": 0,
        "total_epochs": epochs,
        "current_step": 0,
        "max_steps": 0,
        "loss": 0.0,
        "loss_history": [],
        "eval_metrics": None,
        "output_dir": None,
        "status": "Starting up...",
        "error": None
    })

    # Run training in background thread so API doesn't block (to be deprecated in Phase 4)
    t = threading.Thread(
        target=_train_worker, 
        args=(dataset, model_id, batch_size, lr, epochs, lora_rank, output_dir, use_eval)
    )
    t.daemon = True
    t.start()

# =====================================================================
# Phase 3: Discrete Execution Paths
# =====================================================================

def train_small_classifier(dataset_df: pd.DataFrame, input_col: str, output_col: str, output_dir: str):
    """
    Trains a lightweight scikit-learn classifier instead of an LLM.
    Exports as a pickle file.
    """
    import pickle
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    
    os.makedirs(output_dir, exist_ok=True)
    
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=5000, stop_words='english')),
        ('clf', LogisticRegression(max_iter=500))
    ])
    
    df = dataset_df.dropna(subset=[input_col, output_col]).copy()
    X = df[input_col].astype(str)
    y = df[output_col].astype(str)
    
    pipeline.fit(X, y)
    
    model_path = os.path.join(output_dir, "classifier_pipeline.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(pipeline, f)
        
    return {"status": "success", "model_path": model_path, "classes": list(pipeline.classes_)}

def train_extractor(dataset_df: pd.DataFrame, input_col: str, output_col: str, output_dir: str):
    """
    Sets up a prompt-based schema extractor or lightweight regex pipeline.
    """
    import json
    os.makedirs(output_dir, exist_ok=True)
    
    # In a real scenario, this might fine-tune a small token-classifier (like BERT) for NER.
    # For now, it outputs a schema definition template.
    config_path = os.path.join(output_dir, "extractor_config.json")
    with open(config_path, "w") as f:
        json.dump({"type": "schema_extractor", "target_keys": "auto-detected"}, f)
        
    return {"status": "success", "config_path": config_path}

def build_rag_pipeline(dataset_df: pd.DataFrame, input_col: str, output_col: str, output_dir: str):
    """
    Indexes the documents into a vector database instead of fine-tuning.
    """
    import chromadb
    os.makedirs(output_dir, exist_ok=True)
    
    client = chromadb.PersistentClient(path=os.path.join(output_dir, "chroma_index"))
    collection = client.create_collection(name="rag_knowledge_base")
    
    df = dataset_df.dropna(subset=[output_col]).copy()
    docs = df[output_col].astype(str).tolist()
    ids = [f"doc_{i}" for i in range(len(docs))]
    
    collection.add(documents=docs, ids=ids)
    
    return {"status": "success", "index_path": os.path.join(output_dir, "chroma_index")}

