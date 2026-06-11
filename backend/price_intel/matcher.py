from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from difflib import SequenceMatcher

from .models import Product
from .normalizer import NormalizedProduct

class MatchResult(BaseModel):
    match_product_id: Optional[int] = None
    match_confidence: float = 0.0
    match_type: str = "new_product"
    match_reason: str = "No suitable match found"

def calculate_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()

def find_best_product_match(db: Session, normalized: NormalizedProduct) -> MatchResult:
    # Fetch all existing products (in a real system, we'd use Full-Text Search or ElasticSearch)
    existing_products = db.query(Product).all()
    
    if not existing_products:
        return MatchResult()
        
    best_match: Optional[Product] = None
    best_score = 0.0
    match_type = "new_product"
    match_reason = "No match"
    
    for product in existing_products:
        score = 0.0
        
        # Exact Brand + Model match (Tier 1)
        if product.brand and normalized.brand and product.brand.lower() == normalized.brand.lower():
            if product.model and normalized.model and product.model.lower() == normalized.model.lower():
                score = 0.95
                current_type = "exact_brand_model"
                current_reason = "Brand and model matched exactly"
            else:
                score = 0.4 # Brand match, but model differs or missing
                current_type = "partial_brand"
                current_reason = "Brand matched, but model missing or different"
        else:
            # Fuzzy Title Similarity (Tier 2)
            if product.name:
                sim = calculate_similarity(product.name.lower(), normalized.clean_title)
                if sim > 0.8:
                    score = sim
                    current_type = "fuzzy_title"
                    current_reason = f"Fuzzy title match with similarity {sim:.2f}"
                else:
                    score = sim * 0.5
                    current_type = "low_similarity"
                    current_reason = "Title similarity too low"

        if score > best_score:
            best_score = score
            best_match = product
            match_type = current_type
            match_reason = current_reason
            
    # Decision Thresholds
    if best_score >= 0.85:
        return MatchResult(
            match_product_id=best_match.id,
            match_confidence=best_score,
            match_type=match_type,
            match_reason=match_reason
        )
    elif best_score >= 0.65:
        return MatchResult(
            match_product_id=None,
            match_confidence=best_score,
            match_type="needs_review",
            match_reason=f"Found potential match (ID {best_match.id}) but confidence too low ({best_score:.2f}). Needs manual review."
        )
        
    return MatchResult()
