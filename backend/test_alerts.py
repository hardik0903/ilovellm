import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from price_intel.db import Base
from price_intel.models import Product, SourceListing, PriceEvent, AlertRule, Alert, ScrapeAttempt
from price_intel.alerts import evaluate_event_for_alerts

engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

def test_custom_price_drop_trigger(db):
    product = Product(name="Test Product")
    db.add(product)
    db.commit()
    
    listing = SourceListing(product_id=product.id, source_url="http://test.com")
    db.add(listing)
    
    rule = AlertRule(
        product_id=product.id,
        rule_scope="product_specific",
        rule_type="price_drop",
        threshold_percent=10.0
    )
    db.add(rule)
    db.commit()
    
    event = PriceEvent(
        product_id=product.id,
        listing_id=listing.id,
        event_type="price_drop",
        delta_percent=15.0, # Meets rule condition
        delta_value=-150.0,
        new_value="850.0"
    )
    db.add(event)
    db.commit()
    
    alerts = evaluate_event_for_alerts(db, event)
    assert len(alerts) == 1
    assert alerts[0].rule_trigger_source == "price_drop"
    assert "dropped by 15.0%" in alerts[0].message

def test_deduplication(db):
    product = Product(name="Test Product 2")
    rule = AlertRule(rule_type="out_of_stock", rule_scope="global_monitoring")
    db.add_all([product, rule])
    db.commit()
    
    event1 = PriceEvent(product_id=product.id, listing_id=1, event_type="stock_changed", new_value="out_of_stock")
    db.add(event1)
    db.commit()
    
    # First alert should be created
    alerts1 = evaluate_event_for_alerts(db, event1)
    assert len(alerts1) == 1
    db.commit()
    
    # Duplicate event (same state) should NOT create a new alert
    event2 = PriceEvent(product_id=product.id, listing_id=1, event_type="stock_changed", new_value="out_of_stock")
    db.add(event2)
    db.commit()
    
    alerts2 = evaluate_event_for_alerts(db, event2)
    assert len(alerts2) == 0

def test_resolved_alert_reappears(db):
    product = Product(name="Test Product 3")
    rule = AlertRule(rule_type="out_of_stock", rule_scope="global_monitoring")
    db.add_all([product, rule])
    db.commit()
    
    event = PriceEvent(product_id=product.id, listing_id=1, event_type="stock_changed", new_value="out_of_stock")
    db.add(event)
    db.commit()
    
    alerts = evaluate_event_for_alerts(db, event)
    assert len(alerts) == 1
    
    # Resolve the alert
    alerts[0].status = "resolved"
    db.commit()
    
    # Send the same event state again. Since the previous one is resolved, it SHOULD alert again.
    # Because deduplication only blocks if status="unread"
    event2 = PriceEvent(product_id=product.id, listing_id=1, event_type="stock_changed", new_value="out_of_stock")
    db.add(event2)
    db.commit()
    
    alerts2 = evaluate_event_for_alerts(db, event2)
    assert len(alerts2) == 1

def test_consecutive_scrape_failures(db):
    rule = AlertRule(rule_type="scrape_failed", rule_scope="global_monitoring", consecutive_count=3)
    db.add(rule)
    db.commit()
    
    # Insert 3 failed attempts
    attempts = [
        ScrapeAttempt(listing_id=1, status="blocked"),
        ScrapeAttempt(listing_id=1, status="blocked"),
        ScrapeAttempt(listing_id=1, status="blocked")
    ]
    db.add_all(attempts)
    db.commit()
    
    event = PriceEvent(product_id=1, listing_id=1, event_type="scrape_failed", new_value="blocked")
    db.add(event)
    db.commit()
    
    alerts = evaluate_event_for_alerts(db, event)
    assert len(alerts) == 1
    assert "consecutive times" in alerts[0].message
