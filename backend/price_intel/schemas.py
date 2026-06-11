from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime

class ProductCreate(BaseModel):
    name: str
    target_price: Optional[float] = None
    brand: Optional[str] = None
    model_name: Optional[str] = None

class ProductResponse(ProductCreate):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class SourceListingCreate(BaseModel):
    source_url: str

class SourceListingResponse(BaseModel):
    id: int
    product_id: int
    source_name: str
    source_url: str
    title: Optional[str]
    current_price: Optional[float]
    mrp: Optional[float]
    discount_percent: Optional[float]
    currency: Optional[str]
    stock_status: Optional[str]
    latest_scrape_status: Optional[str]
    latest_block_reason: Optional[str]
    last_seen_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class PriceObservationResponse(BaseModel):
    id: int
    observed_price: float
    observed_mrp: Optional[float]
    observed_at: datetime
    
    class Config:
        from_attributes = True

class PriceObservationSchema(BaseModel):
    id: int
    listing_id: int
    observed_price: float
    observed_mrp: Optional[float] = None
    observed_at: datetime
    
    # We will compute these in the route for the UI
    source_name: Optional[str] = None
    seller_name: Optional[str] = None
    stock_status: Optional[str] = None

    class Config:
        from_attributes = True

class AlertRuleCreate(BaseModel):
    product_id: Optional[int] = None
    rule_scope: str = "product_specific"
    rule_type: str
    threshold_value: Optional[float] = None
    threshold_percent: Optional[float] = None
    consecutive_count: int = 1
    is_active: bool = True

class AlertRuleSchema(AlertRuleCreate):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class AlertSchema(BaseModel):
    id: int
    product_id: Optional[int]
    listing_id: Optional[int]
    rule_trigger_source: str
    message: str
    severity: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProductDetailResponse(ProductResponse):
    listings: List[SourceListingResponse] = []
    
    class Config:
        from_attributes = True
