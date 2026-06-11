import hashlib
from typing import List
from sqlalchemy.orm import Session
from .models import PriceEvent, AlertRule, Alert, ScrapeAttempt

def generate_dedupe_hash(rule_id: int, product_id: int, listing_id: int, state: str) -> str:
    raw = f"{rule_id}_{product_id}_{listing_id}_{state}"
    return hashlib.md5(raw.encode()).hexdigest()

def check_consecutive_failures(db: Session, listing_id: int, required_count: int) -> bool:
    attempts = db.query(ScrapeAttempt).filter(
        ScrapeAttempt.listing_id == listing_id
    ).order_by(ScrapeAttempt.attempted_at.desc()).limit(required_count).all()
    
    if len(attempts) < required_count:
        return False
        
    return all(a.status != "success" for a in attempts)

def evaluate_event_for_alerts(db: Session, event: PriceEvent) -> List[Alert]:
    created_alerts = []
    
    # Fetch relevant active rules
    rules = db.query(AlertRule).filter(
        AlertRule.is_active == True,
        ((AlertRule.rule_scope == "global_monitoring") | (AlertRule.product_id == event.product_id))
    ).all()
    
    for rule in rules:
        should_alert = False
        message = ""
        dedupe_state = ""
        severity = "medium"
        
        # 1. Price Drop Rule
        if rule.rule_type == "price_drop" and event.event_type == "price_drop":
            pct_met = rule.threshold_percent and event.delta_percent and event.delta_percent >= rule.threshold_percent
            val_met = rule.threshold_value and event.delta_value and abs(event.delta_value) >= rule.threshold_value
            
            if pct_met or val_met:
                should_alert = True
                message = f"Price dropped by {event.delta_percent:.1f}% to {event.new_value}"
                dedupe_state = f"price_{event.new_value}"
                severity = "high" if event.delta_percent and event.delta_percent > 15 else "medium"

        # 2. Scrape Failed Rule
        elif rule.rule_type == "scrape_failed" and event.event_type == "scrape_failed":
            if check_consecutive_failures(db, event.listing_id, rule.consecutive_count):
                should_alert = True
                message = f"Scraping failed {rule.consecutive_count} consecutive times: {event.new_value}"
                dedupe_state = f"fail_{rule.consecutive_count}_{event.new_value}"
                severity = "medium"
                
        # 3. Out of Stock Rule
        elif rule.rule_type == "out_of_stock" and event.event_type == "stock_changed":
            if event.new_value == "out_of_stock":
                should_alert = True
                message = "Product went out of stock"
                dedupe_state = "out_of_stock"
                severity = "high"
                
        if should_alert:
            d_hash = generate_dedupe_hash(rule.id, event.product_id, event.listing_id, dedupe_state)
            
            # Check if this exact alert is already active
            existing = db.query(Alert).filter(
                Alert.dedupe_hash == d_hash,
                Alert.status == "unread"
            ).first()
            
            if not existing:
                alert = Alert(
                    product_id=event.product_id,
                    listing_id=event.listing_id,
                    event_id=event.id,
                    rule_id=rule.id,
                    rule_trigger_source=event.event_type,
                    message=message,
                    severity=severity,
                    dedupe_hash=d_hash,
                    status="unread"
                )
                db.add(alert)
                created_alerts.append(alert)
                
    return created_alerts
