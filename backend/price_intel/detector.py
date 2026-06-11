from typing import List
from sqlalchemy.orm import Session
from .models import SourceListing, PriceObservation, ScrapeAttempt, PriceEvent

def get_severity_for_price_drop(delta_abs: float, delta_pct: float) -> str:
    if delta_pct >= 15.0 or delta_abs >= 1000.0:
        return "high"
    if delta_pct >= 5.0 or delta_abs >= 250.0:
        return "medium"
    return "low"

def get_severity_for_price_increase(delta_abs: float, delta_pct: float) -> str:
    if delta_pct >= 15.0 or delta_abs >= 1000.0:
        return "high"
    if delta_pct >= 5.0 or delta_abs >= 250.0:
        return "medium"
    return "low"

def detect_changes(db: Session, listing_id: int) -> List[PriceEvent]:
    events = []
    
    listing = db.query(SourceListing).filter(SourceListing.id == listing_id).first()
    if not listing:
        return events
        
    latest_attempt = db.query(ScrapeAttempt).filter(
        ScrapeAttempt.listing_id == listing_id
    ).order_by(ScrapeAttempt.attempted_at.desc()).first()
    
    if latest_attempt and latest_attempt.status not in ["success", "no_product_found"]:
        # Only emit if it's a new failure (to avoid spamming, check previous attempt)
        prev_attempt = db.query(ScrapeAttempt).filter(
            ScrapeAttempt.listing_id == listing_id,
            ScrapeAttempt.id != latest_attempt.id
        ).order_by(ScrapeAttempt.attempted_at.desc()).first()
        
        if not prev_attempt or prev_attempt.status == "success":
            events.append(PriceEvent(
                product_id=listing.product_id,
                listing_id=listing.id,
                event_type="scrape_failed",
                old_value=prev_attempt.status if prev_attempt else "none",
                new_value=latest_attempt.status,
                severity="medium",
                metadata_json={"block_reason": latest_attempt.block_reason}
            ))
        return events
        
    # Last two valid observations
    observations = db.query(PriceObservation).filter(
        PriceObservation.listing_id == listing_id
    ).order_by(PriceObservation.observed_at.desc()).limit(2).all()
    
    if len(observations) < 2:
        return events 
        
    latest_obs = observations[0]
    prev_obs = observations[1]
    
    # 1. Price Change
    if latest_obs.observed_price != prev_obs.observed_price:
        delta_val = latest_obs.observed_price - prev_obs.observed_price
        delta_pct = (abs(delta_val) / prev_obs.observed_price) * 100 if prev_obs.observed_price else 0.0
        
        if delta_val < 0:
            event_type = "price_drop"
            severity = get_severity_for_price_drop(abs(delta_val), delta_pct)
        else:
            event_type = "price_increase"
            severity = get_severity_for_price_increase(abs(delta_val), delta_pct)
            
        events.append(PriceEvent(
            product_id=listing.product_id,
            listing_id=listing.id,
            event_type=event_type,
            old_value=str(prev_obs.observed_price),
            new_value=str(latest_obs.observed_price),
            delta_value=delta_val,
            delta_percent=delta_pct,
            severity=severity
        ))
        
    # 2. Stock Change
    if latest_obs.observed_stock_status != prev_obs.observed_stock_status:
        events.append(PriceEvent(
            product_id=listing.product_id,
            listing_id=listing.id,
            event_type="stock_changed",
            old_value=prev_obs.observed_stock_status or "unknown",
            new_value=latest_obs.observed_stock_status or "unknown",
            severity="high" if latest_obs.observed_stock_status == "out_of_stock" else "medium"
        ))
        
    # 3. Seller Change
    if latest_obs.observed_seller_name != prev_obs.observed_seller_name:
        events.append(PriceEvent(
            product_id=listing.product_id,
            listing_id=listing.id,
            event_type="seller_changed",
            old_value=prev_obs.observed_seller_name or "unknown",
            new_value=latest_obs.observed_seller_name or "unknown",
            severity="medium"
        ))

    # 4. Shipping Change
    if latest_obs.observed_shipping_cost != prev_obs.observed_shipping_cost:
        events.append(PriceEvent(
            product_id=listing.product_id,
            listing_id=listing.id,
            event_type="shipping_changed",
            old_value=str(prev_obs.observed_shipping_cost),
            new_value=str(latest_obs.observed_shipping_cost),
            severity="low"
        ))
        
    # 5. Discount Change
    if latest_obs.observed_discount_percent != prev_obs.observed_discount_percent:
        events.append(PriceEvent(
            product_id=listing.product_id,
            listing_id=listing.id,
            event_type="discount_changed",
            old_value=str(prev_obs.observed_discount_percent),
            new_value=str(latest_obs.observed_discount_percent),
            severity="low"
        ))

    return events
