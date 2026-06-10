import pandas as pd
import json
import numpy as np
from typing import Dict, Any, List

def check_suitability(df: pd.DataFrame, input_col: str, output_col: str) -> Dict[str, Any]:
    """
    Analyzes the dataset to recommend the best machine learning approach.
    """
    total_rows = len(df)
    
    # If the dataset is too small
    if total_rows < 50:
        return {
            "task_type": "Too few samples",
            "best_option": "Prompt Engineering",
            "fine_tuning_needed": False,
            "reason": "You have less than 50 examples. Try using few-shot prompting with a strong base model instead of fine-tuning."
        }
        
    # Check output characteristics
    unique_outputs = df[output_col].nunique()
    avg_output_len = df[output_col].astype(str).str.len().mean()
    
    # Check if outputs look like JSON
    sample_outputs = df[output_col].dropna().head(10).astype(str).tolist()
    looks_like_json = any(s.strip().startswith('{') and s.strip().endswith('}') for s in sample_outputs)
    
    if looks_like_json:
        return {
            "task_type": "Structured Extraction",
            "best_option": "JSON Structured Output Fine-Tuning",
            "fine_tuning_needed": True,
            "reason": "The output expects structured JSON data. Fine-tuning a model to generate reliable schema-conforming JSON is highly recommended."
        }
        
    if unique_outputs <= 30 and avg_output_len < 100:
        return {
            "task_type": "Classification",
            "best_option": "Supervised Classifier",
            "fine_tuning_needed": False,
            "reason": f"Output is one of {unique_outputs} fixed labels. A lightweight classifier or embeddings-based search is often faster and cheaper than full LLM fine-tuning."
        }
        
    if avg_output_len > 500:
        return {
            "task_type": "Long-form Generation",
            "best_option": "Retrieval-Augmented Generation (RAG) + Light Fine-Tuning",
            "fine_tuning_needed": "Maybe",
            "reason": "Outputs are very long. Consider using RAG to fetch context rather than relying purely on the model's parametric memory."
        }
        
    return {
        "task_type": "Instruction / Chat",
        "best_option": "Supervised Fine-Tuning (SFT)",
        "fine_tuning_needed": True,
        "reason": "The data follows a conversational or instruction-response format. SFT is the standard approach to teach the model your specific tone and format."
    }

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
