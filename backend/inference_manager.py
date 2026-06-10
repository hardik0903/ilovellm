import os
import time
import shutil
import zipfile
import json
import asyncio
from typing import Dict, Any
import joblib

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
except ImportError:
    AutoModelForCausalLM, AutoTokenizer, PeftModel = None, None, None

from queue_manager import get_artifact_by_job

CACHE_DIR = "./models/cache"
os.makedirs(CACHE_DIR, exist_ok=True)

class LRUModelCache:
    def __init__(self, max_size=2):
        self.max_size = max_size
        self.cache = {}  # artifact_id -> entry
        self.base_model = None
        self.base_model_id = None
        self.base_tokenizer = None

    def _evict(self):
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]['last_used'])
            print(f"[LRU Cache] Evicting artifact {oldest_key} to free memory.")
            
            entry = self.cache.pop(oldest_key)
            del entry['model']
            
            cache_path = os.path.join(CACHE_DIR, oldest_key)
            if os.path.exists(cache_path):
                try:
                    shutil.rmtree(cache_path)
                    print(f"[LRU Cache] Deleted cached directory {cache_path}")
                except Exception as e:
                    print(f"[LRU Cache] Failed to delete {cache_path}: {e}")

    def get_or_load(self, artifact_id: str):
        if artifact_id in self.cache:
            self.cache[artifact_id]['last_used'] = time.time()
            return self.cache[artifact_id]

        self._evict()

        artifact_record = get_artifact_by_job(artifact_id)
        if not artifact_record:
            raise ValueError(f"Artifact {artifact_id} not found in registry.")

        zip_path = artifact_record['artifact_path']
        if not os.path.exists(zip_path):
            raise FileNotFoundError(f"Artifact ZIP {zip_path} is missing from disk.")

        extract_dir = os.path.join(CACHE_DIR, artifact_id)
        if os.path.exists(extract_dir):
            shutil.rmtree(extract_dir)
        os.makedirs(extract_dir, exist_ok=True)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)

        meta_path = os.path.join(extract_dir, "metadata.json")
        if not os.path.exists(meta_path):
            raise ValueError("Invalid artifact: missing metadata.json")
            
        with open(meta_path, "r") as f:
            metadata = json.load(f)

        task_type = metadata.get("task_type", "unknown")
        exec_mode = artifact_record['execution_mode']
        
        if task_type == "classification" or exec_mode == 'classifier':
            model_pkl = os.path.join(extract_dir, "model.pkl")
            model = joblib.load(model_pkl)
            self.cache[artifact_id] = {
                "type": "sklearn",
                "model": model,
                "metadata": metadata,
                "last_used": time.time()
            }
            
        elif task_type == "json-extraction" or exec_mode == 'extractor':
            self.cache[artifact_id] = {
                "type": "extractor",
                "model": None,
                "metadata": metadata,
                "last_used": time.time()
            }
            
        elif task_type == "rag" or exec_mode == 'rag':
            import chromadb
            client = chromadb.PersistentClient(path=extract_dir)
            collection = client.get_or_create_collection(name="finetuned_rag")
            self.cache[artifact_id] = {
                "type": "rag",
                "model": collection,
                "metadata": metadata,
                "last_used": time.time()
            }
            
        elif task_type == "lora_sft" or exec_mode == 'lora_sft':
            if not AutoModelForCausalLM:
                raise ImportError("Transformers/PEFT is not installed.")
                
            base_model_name = metadata.get("base_model_id", "Qwen/Qwen2.5-0.5B-Instruct")
            
            if self.base_model_id != base_model_name:
                print(f"[LRU Cache] Loading Base Model {base_model_name}...")
                self.base_model = AutoModelForCausalLM.from_pretrained(
                    base_model_name,
                    device_map="cpu" # Forcing CPU for safety in this studio environment
                )
                self.base_tokenizer = AutoTokenizer.from_pretrained(base_model_name)
                self.base_model_id = base_model_name
                
            if isinstance(self.base_model, PeftModel):
                self.base_model.load_adapter(extract_dir, adapter_name=artifact_id)
            else:
                self.base_model = PeftModel.from_pretrained(
                    self.base_model, 
                    extract_dir, 
                    adapter_name=artifact_id
                )
                
            self.cache[artifact_id] = {
                "type": "lora",
                "model": self.base_model,
                "tokenizer": self.base_tokenizer,
                "adapter_name": artifact_id,
                "metadata": metadata,
                "last_used": time.time()
            }
        else:
            raise ValueError(f"Unknown artifact type: {exec_mode}")

        return self.cache[artifact_id]

model_cache = LRUModelCache()

def estimate_cost(tokens: int, model_type: str) -> float:
    cost_map = {
        "Qwen/Qwen2.5-0.5B-Instruct": 0.0001,
        "HuggingFaceTB/SmolLM-360M-Instruct": 0.00005,
        "sklearn": 0.000001,
        "extractor": 0.000001,
        "rag": 0.00001
    }
    rate = cost_map.get(model_type, 0.0001)
    return (tokens / 1000.0) * rate

def _run_inference_sync(artifact_id: str, input_data: str, is_base_model: bool = False, base_model_id: str = "Qwen/Qwen2.5-0.5B-Instruct", max_tokens: int = 100):
    start_time = time.time()
    
    if is_base_model:
        if model_cache.base_model_id != base_model_id:
            if AutoModelForCausalLM is None:
                 raise ImportError("Transformers is not installed.")
            print(f"[LRU Cache] Loading Base Model {base_model_id}...")
            model_cache.base_model = AutoModelForCausalLM.from_pretrained(base_model_id, device_map="cpu")
            model_cache.base_tokenizer = AutoTokenizer.from_pretrained(base_model_id)
            model_cache.base_model_id = base_model_id
            
        model = model_cache.base_model
        tokenizer = model_cache.base_tokenizer
        
        inputs = tokenizer(input_data, return_tensors="pt")
        
        if isinstance(model, PeftModel):
            with model.disable_adapter():
                outputs = model.generate(**inputs, max_new_tokens=max_tokens)
        else:
            outputs = model.generate(**inputs, max_new_tokens=max_tokens)
            
        result_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        if result_text.startswith(input_data):
            result_text = result_text[len(input_data):].strip()
        
        tokens_generated = max(1, len(outputs[0]) - len(inputs["input_ids"][0]))
        latency = time.time() - start_time
        
        return {
            "output": result_text,
            "metrics": {
                "latency_ms": round(latency * 1000),
                "tokens_per_second": round(tokens_generated / latency, 2) if latency > 0 else 0,
                "estimated_cost_per_1k_requests": f"${estimate_cost(tokens_generated, base_model_id) * 1000:.4f}"
            }
        }
            
    entry = model_cache.get_or_load(artifact_id)
    
    if entry["type"] == "sklearn":
        model = entry["model"]
        prediction = model.predict([input_data])[0]
        latency = time.time() - start_time
        return {
            "output": str(prediction),
            "metrics": {
                "latency_ms": round(latency * 1000),
                "tokens_per_second": "N/A (Scikit-Learn)",
                "estimated_cost_per_1k_requests": f"${estimate_cost(1, 'sklearn') * 1000:.6f}"
            }
        }
        
    elif entry["type"] == "extractor":
        schema = entry["metadata"].get("schema", {})
        latency = time.time() - start_time
        return {
            "output": f"```json\n{{\n  \"extracted_field\": \"Mock extraction for {input_data[:20]}...\"\n}}\n```",
            "metrics": {
                "latency_ms": round(latency * 1000),
                "tokens_per_second": "N/A (Extractor)",
                "estimated_cost_per_1k_requests": f"${estimate_cost(1, 'extractor') * 1000:.6f}"
            }
        }
        
    elif entry["type"] == "rag":
        collection = entry["model"]
        results = collection.query(query_texts=[input_data], n_results=1)
        latency = time.time() - start_time
        retrieved = results['documents'][0][0] if results['documents'] and results['documents'][0] else "No context found."
        return {
            "output": f"Based on knowledge base: {retrieved}",
            "metrics": {
                "latency_ms": round(latency * 1000),
                "tokens_per_second": "N/A (RAG)",
                "estimated_cost_per_1k_requests": f"${estimate_cost(1, 'rag') * 1000:.6f}"
            }
        }
        
    elif entry["type"] == "lora":
        model = entry["model"]
        tokenizer = entry["tokenizer"]
        adapter_name = entry["adapter_name"]
        
        model.set_adapter(adapter_name)
        
        inputs = tokenizer(input_data, return_tensors="pt")
        outputs = model.generate(**inputs, max_new_tokens=max_tokens)
        result_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        if result_text.startswith(input_data):
            result_text = result_text[len(input_data):].strip()
            
        tokens_generated = max(1, len(outputs[0]) - len(inputs["input_ids"][0]))
        latency = time.time() - start_time
        
        return {
            "output": result_text,
            "metrics": {
                "latency_ms": round(latency * 1000),
                "tokens_per_second": round(tokens_generated / latency, 2) if latency > 0 else 0,
                "estimated_cost_per_1k_requests": f"${estimate_cost(tokens_generated, model_cache.base_model_id) * 1000:.4f}"
            }
        }

async def run_inference(artifact_id: str, input_data: str, is_base_model: bool = False, base_model_id: str = "Qwen/Qwen2.5-0.5B-Instruct", max_tokens: int = 100):
    """Runs inference in a non-blocking thread to prevent FastAPI from freezing."""
    return await asyncio.to_thread(_run_inference_sync, artifact_id, input_data, is_base_model, base_model_id, max_tokens)
