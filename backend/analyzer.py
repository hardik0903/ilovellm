import pandas as pd
import json
import numpy as np
from typing import Dict, Any, List

def run_baselines(df: pd.DataFrame, input_col: str, output_col: str, execution_mode: str) -> Dict[str, Any]:
    """
    Phase 2: Baseline Engine
    Quickly tests the cheapest solutions before committing to heavy fine-tuning.
    Returns baseline metrics and a recommendation to skip training if baseline is strong.
    """
    if execution_mode == "classifier":
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import LogisticRegression
            from sklearn.model_selection import train_test_split
            
            df_valid = df.dropna(subset=[input_col, output_col]).copy()
            if len(df_valid) < 10:
                return {
                    "baseline_method": "LogisticRegression + TF-IDF",
                    "accuracy_score": None,
                    "is_sufficient": False,
                    "message": "Not enough valid rows for a confident baseline."
                }
                
            X_text = df_valid[input_col].astype(str)
            y = df_valid[output_col].astype(str)
            
            if len(X_text) > 5000:
                X_text, y = X_text.iloc[:5000], y.iloc[:5000]
                
            stratify_y = y if (len(y.unique()) > 1 and min(y.value_counts()) >= 2) else None
            X_train, X_test, y_train, y_test = train_test_split(X_text, y, test_size=0.2, stratify=stratify_y)
            
            vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
            X_train_vec = vectorizer.fit_transform(X_train)
            X_test_vec = vectorizer.transform(X_test)
            
            model = LogisticRegression(max_iter=100)
            model.fit(X_train_vec, y_train)
            accuracy = model.score(X_test_vec, y_test)
            
            return {
                "baseline_method": "LogisticRegression + TF-IDF (80/20 split)",
                "accuracy_score": float(accuracy),
                "is_sufficient": bool(accuracy > 0.90),
                "message": f"Baseline classifier achieved {accuracy*100:.1f}% accuracy on a 20% hold-out set."
            }
        except Exception as e:
            pass
            
    elif execution_mode == "lora_sft":
        return {
            "baseline_method": "Zero-shot Prompting",
            "accuracy_score": None,
            "is_sufficient": False,
            "message": "Generative tasks usually require fine-tuning to perfectly match your specific format/tone. A zero-shot baseline is assumed to be suboptimal."
        }
        
    return {
        "baseline_method": "Heuristic Rules",
        "accuracy_score": None,
        "is_sufficient": False,
        "message": "No fast baseline could confidently solve this task."
    }

def estimate_resources(valid_rows: int, avg_input_len: float, avg_output_len: float, execution_mode: str) -> dict:
    approx_tokens_per_row = (avg_input_len + avg_output_len) / 4.0
    total_tokens = int(valid_rows * approx_tokens_per_row)
    
    base_est = {"estimated_tokens": total_tokens}
    
    if execution_mode == "classifier":
        base_est.update({"expected_runtime": "< 1 min", "expected_ram": "500 MB", "expected_disk": "10 MB", "expected_artifact_size": "< 1 MB"})
    elif execution_mode == "extractor":
        base_est.update({"expected_runtime": "5 mins", "expected_ram": "1 GB", "expected_disk": "50 MB", "expected_artifact_size": "< 1 MB"})
    elif execution_mode == "rag":
        base_est.update({"expected_runtime": f"{max(1, int(total_tokens / 10000))} mins", "expected_ram": "2 GB", "expected_disk": f"{max(10, int(total_tokens / 1000))} MB", "expected_artifact_size": f"{max(10, int(total_tokens / 1000))} MB"})
    elif execution_mode == "lora_sft":
        base_est.update({"expected_runtime": f"{max(30, int(total_tokens / 5000))} mins", "expected_ram": "12 GB", "expected_disk": "8 GB", "expected_artifact_size": "200 MB"})
    else:
        base_est.update({"expected_runtime": "0 mins", "expected_ram": "0 MB", "expected_disk": "0 MB", "expected_artifact_size": "0 MB"})
        
    return base_est

def generate_training_plan(df: pd.DataFrame, input_col: str, output_col: str) -> Dict[str, Any]:
    """
    Intelligent Task Router: Analyzes the dataset and generates a strict execution plan.
    Enforces hard routing rules to prevent unnecessary LLM fine-tuning.
    """
    total_rows = len(df)
    quality_flags = []
    
    # 1. Dataset Readiness Gate
    df = df.dropna(subset=[input_col, output_col])
    valid_rows = len(df)
    if total_rows - valid_rows > 0:
        quality_flags.append(f"Dropped {total_rows - valid_rows} rows with missing values.")
        
    df['output_len'] = df[output_col].astype(str).str.len()
    avg_output_len = df['output_len'].mean()
    df['input_len'] = df[input_col].astype(str).str.len()
    avg_input_len = df['input_len'].mean()
    
    unique_outputs = df[output_col].nunique()
    
    # Check for imbalance
    if unique_outputs > 1 and unique_outputs <= 20:
        val_counts = df[output_col].value_counts()
        if val_counts.max() > (val_counts.min() * 10):
            quality_flags.append("Severe class imbalance detected.")
            
    # Check for duplicates
    duplicates = df.duplicated(subset=[input_col, output_col]).sum()
    if valid_rows > 0 and (duplicates / valid_rows) > 0.5:
        return {
            "task_type": "unknown",
            "execution_mode": "manual_review",
            "recommended_approach": "Human Review",
            "confidence": 0.20,
            "should_train": False,
            "dataset_quality_flags": quality_flags + ["Dataset is 50%+ duplicates."],
            "reasoning": "I cannot confidently determine the best approach due to extreme data duplication. Review required.",
            "resource_estimates": estimate_resources(valid_rows, avg_input_len, avg_output_len, "manual_review")
        }
            
    # 2. Hard Routing Rules
    
    # Rule A: Too little data
    if valid_rows < 50:
        return {
            "task_type": "few_shot_prompting",
            "execution_mode": "no_train",
            "recommended_approach": "Prompt Engineering",
            "confidence": 0.98,
            "should_train": False,
            "dataset_quality_flags": quality_flags + ["Dataset is too small for reliable fine-tuning."],
            "reasoning": f"You only have {valid_rows} valid examples. LLMs require hundreds of examples to learn format reliably. Use few-shot prompting instead.",
            "resource_estimates": estimate_resources(valid_rows, avg_input_len, avg_output_len, "no_train")
        }
        
    # Rule B: Structured Data Extraction (JSON)
    sample_outputs = df[output_col].head(10).astype(str).tolist()
    looks_like_json = any(s.strip().startswith('{') and s.strip().endswith('}') for s in sample_outputs)
    if looks_like_json:
        plan = {
            "task_type": "structured_extraction",
            "execution_mode": "extractor",
            "recommended_approach": "Schema Extractor Model",
            "confidence": 0.92,
            "should_train": True,
            "dataset_quality_flags": quality_flags,
            "reasoning": "Output is formatted as JSON. We will route this to a lightweight schema-extraction model rather than a conversational LLM.",
            "resource_estimates": estimate_resources(valid_rows, avg_input_len, avg_output_len, "extractor")
        }
        
    # Rule C: Classification (Fixed labels)
    elif unique_outputs <= 30 and avg_output_len < 100:
        plan = {
            "task_type": "classification",
            "execution_mode": "classifier",
            "recommended_approach": "Small Classifier (scikit-learn / XGBoost)",
            "confidence": 0.95,
            "should_train": True,
            "dataset_quality_flags": quality_flags,
            "reasoning": f"Output consists of {unique_outputs} fixed categories. A small classifier is 100x faster and more accurate than LLM fine-tuning for this task.",
            "resource_estimates": estimate_resources(valid_rows, avg_input_len, avg_output_len, "classifier")
        }
        
    # Rule D: Retrieval / RAG (Very long outputs)
    elif avg_output_len > 1000:
        plan = {
            "task_type": "document_qa",
            "execution_mode": "rag",
            "recommended_approach": "Retrieval-Augmented Generation (RAG)",
            "confidence": 0.88,
            "should_train": False,
            "dataset_quality_flags": quality_flags + ["Outputs are extremely long."],
            "reasoning": "The target outputs are very long documents. Fine-tuning models to memorize long text is inefficient; use RAG to index and retrieve this knowledge.",
            "resource_estimates": estimate_resources(valid_rows, avg_input_len, avg_output_len, "rag")
        }
        
    # Rule E: Conversational / Instruction Tuning
    else:
        plan = {
            "task_type": "instruction_tuning",
            "execution_mode": "lora_sft",
            "recommended_approach": "LoRA Supervised Fine-Tuning",
            "confidence": 0.85,
            "should_train": True,
            "dataset_quality_flags": quality_flags,
            "reasoning": "Data follows a conversational instruction-response pattern with sufficient volume. Suitable for LoRA fine-tuning.",
            "resource_estimates": estimate_resources(valid_rows, avg_input_len, avg_output_len, "lora_sft")
        }
    
    # 3. Baseline Checker
    baselines = run_baselines(df, input_col, output_col, plan["execution_mode"])
    plan["baseline_results"] = baselines
    
    if baselines.get("is_sufficient", False):
        plan["should_train"] = False
        plan["reasoning"] += f" However, training is NOT recommended because the baseline ({baselines['baseline_method']}) is already extremely strong."
        
    return plan

def analyze_quality(df: pd.DataFrame, input_col: str, output_col: str) -> Dict[str, Any]:
    """
    Inspects the dataset and reports on quality metrics.
    """
    total_rows = len(df)
    
    # Missing values
    missing_inputs = df[input_col].isna().sum()
    missing_outputs = df[output_col].isna().sum()
    
    # Duplicates
    duplicates = df.duplicated(subset=[input_col, output_col]).sum()
    
    # Output length
    df['output_len'] = df[output_col].astype(str).str.len()
    avg_output_len = df['output_len'].mean()
    
    # Noisy examples (extremely short or empty outputs)
    noisy_samples = (df['output_len'] < 3).sum()
    
    # Class distribution (if classification-like)
    unique_outputs = df[output_col].nunique()
    class_distribution = {}
    imbalance_warning = False
    
    if unique_outputs <= 20:
        value_counts = df[output_col].value_counts()
        class_distribution = value_counts.to_dict()
        
        # Check for imbalance (if the most frequent class is > 5x the least frequent)
        if len(value_counts) > 1:
            max_class = value_counts.max()
            min_class = value_counts.min()
            if max_class > (min_class * 5):
                imbalance_warning = True
                
    warnings = []
    if missing_inputs > 0 or missing_outputs > 0:
        warnings.append(f"Found {missing_inputs + missing_outputs} rows with missing values.")
    if duplicates > (total_rows * 0.05):
        warnings.append(f"High duplication rate: {duplicates} duplicate rows ({round((duplicates/total_rows)*100, 1)}%).")
    if noisy_samples > 0:
        warnings.append(f"Found {noisy_samples} noisy/suspiciously short examples.")
    if imbalance_warning:
        warnings.append("Severe class imbalance detected. Consider rebalancing data.")
        
    return {
        "total_rows": int(total_rows),
        "duplicates": int(duplicates),
        "missing_values": int(missing_inputs + missing_outputs),
        "noisy_samples": int(noisy_samples),
        "avg_input_length": float(df[input_col].astype(str).str.len().mean()),
        "avg_output_length": float(avg_output_len),
        "unique_outputs": int(unique_outputs),
        "class_distribution": class_distribution,
        "warnings": warnings
    }

def convert_to_training_format(df: pd.DataFrame, input_col: str, output_col: str, target_format: str) -> List[Dict]:
    """
    Converts raw dataframe into the target fine-tuning format and returns a preview list.
    Formats: 'instruction-response', 'chatml', 'classification'
    """
    preview = []
    
    # Fill NAs
    df = df.fillna("")
    
    for idx, row in df.head(3).iterrows():
        user_text = str(row[input_col])
        assistant_text = str(row[output_col])
        
        if target_format == 'chatml':
            preview.append(f"<|im_start|>user\\n{user_text}<|im_end|>\\n<|im_start|>assistant\\n{assistant_text}<|im_end|>")
            
        elif target_format == 'instruction-response':
            preview.append({
                "instruction": user_text,
                "response": assistant_text
            })
            
        elif target_format == 'classification':
            preview.append({
                "text": user_text,
                "label": assistant_text
            })
            
        elif target_format == 'conversation':
            preview.append({
                "messages": [
                    {"role": "user", "content": user_text},
                    {"role": "assistant", "content": assistant_text}
                ]
            })
            
    return preview

def suggest_labels(df: pd.DataFrame, input_col: str, output_col: str) -> List[Dict]:
    """
    Uses simple TF-IDF and Nearest Neighbors to suggest labels for unlabeled rows.
    """
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.neighbors import KNeighborsClassifier
    except ImportError:
        return {"error": "scikit-learn is required for label suggestions. Please install it."}
        
    # Split into labeled and unlabeled
    labeled = df[df[output_col].notna() & (df[output_col] != "")]
    unlabeled = df[df[output_col].isna() | (df[output_col] == "")]
    
    if len(labeled) < 5:
        return {"error": "Need at least 5 labeled examples to make suggestions."}
    if len(unlabeled) == 0:
        return {"error": "No unlabeled rows found."}
        
    vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
    X_train = vectorizer.fit_transform(labeled[input_col].astype(str))
    y_train = labeled[output_col].astype(str)
    
    knn = KNeighborsClassifier(n_neighbors=min(3, len(labeled)))
    knn.fit(X_train, y_train)
    
    X_unlabeled = vectorizer.transform(unlabeled[input_col].astype(str))
    predictions = knn.predict(X_unlabeled)
    
    suggestions = []
    for i, idx in enumerate(unlabeled.index[:20]): # Return max 20 suggestions
        suggestions.append({
            "index": int(idx),
            "input": str(unlabeled.loc[idx, input_col]),
            "suggested_label": str(predictions[i])
        })
        
    return {"suggestions": suggestions}
