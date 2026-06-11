import re
from typing import Optional
from pydantic import BaseModel

class NormalizedProduct(BaseModel):
    clean_title: str
    brand: Optional[str] = None
    model: Optional[str] = None
    gtin: Optional[str] = None

KNOWN_BRANDS = [
    "apple", "samsung", "sony", "lg", "dell", "hp", "lenovo", "asus", 
    "acer", "microsoft", "google", "oneplus", "xiaomi", "vivo", "oppo"
]

def clean_text(text: str) -> str:
    if not text:
        return ""
    # Remove promotional fluff
    text = re.sub(r'(?i)(discount|sale|offer|% off|\bnew\b|\brefurbished\b)', '', text)
    # Remove special characters
    text = re.sub(r'[^a-zA-Z0-9\s-]', ' ', text)
    return ' '.join(text.lower().split())

def extract_brand(title: str) -> Optional[str]:
    title_lower = title.lower()
    for brand in KNOWN_BRANDS:
        if re.search(rf'\b{brand}\b', title_lower):
            return brand.capitalize()
    return None

def extract_model(title: str, brand: Optional[str]) -> Optional[str]:
    # Very basic model extraction: everything after brand up to a comma or hyphen
    if not brand:
        return None
    
    # Try to find text right after the brand
    match = re.search(rf'(?i)\b{brand}\b\s+([A-Za-z0-9\s]+?)(?:[-,\(]|$)', title)
    if match:
        model = match.group(1).strip()
        # Ensure it's not too long (keep it concise)
        return ' '.join(model.split()[:4])
    return None

def normalize_listing(title: str) -> NormalizedProduct:
    clean_t = clean_text(title)
    brand = extract_brand(title)
    model = extract_model(title, brand)
    
    return NormalizedProduct(
        clean_title=clean_t,
        brand=brand,
        model=model
    )
