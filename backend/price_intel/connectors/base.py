from typing import Optional, Dict, Any
from pydantic import BaseModel

class ConnectorResult(BaseModel):
    status: str # 'success', 'blocked', 'captcha', 'rate_limited', 'parse_failed', 'no_product_found', 'error'
    block_reason: Optional[str] = None
    
    title: Optional[str] = None
    price: Optional[float] = None
    mrp: Optional[float] = None
    discount_percent: Optional[float] = None
    shipping_cost: Optional[float] = None
    currency: str = "INR"
    availability: Optional[str] = None
    seller_name: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    
    source_listing_id: Optional[str] = None
    raw_html_hash: Optional[str] = None
    raw_text_excerpt: Optional[str] = None

class BaseConnector:
    async def scrape(self, url: str) -> ConnectorResult:
        raise NotImplementedError("Subclasses must implement scrape()")
