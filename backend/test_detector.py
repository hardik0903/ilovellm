import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from price_intel.db import Base
from price_intel.models import Product, SourceListing, PriceObservation, ScrapeAttempt, PriceEvent
from price_intel.detector import detect_changes, get_severity_for_price_drop, get_severity_for_price_increase
from price_intel.service import run_scrape_for_listing
from price_intel.connectors.base import BaseConnector, ConnectorResult
import price_intel.service

# Setup Test DB
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

# A. Unit tests for the detector
def test_severity_rules():
    # Price drop severity
    assert get_severity_for_price_drop(100, 16.0) == "high"    # >15%
    assert get_severity_for_price_drop(1200, 2.0) == "high"    # >1000
    assert get_severity_for_price_drop(300, 6.0) == "medium"   # >5% and >250
    assert get_severity_for_price_drop(50, 2.0) == "low"

def test_detect_price_drop(db):
    product = Product(name="Test")
    db.add(product)
    db.commit()
    
    listing = SourceListing(product_id=product.id, source_name="web", source_url="http://test.com")
    db.add(listing)
    db.commit()
    
    # Previous observation
    obs1 = PriceObservation(listing_id=listing.id, observed_price=1000, observed_at=datetime.utcnow() - timedelta(days=1))
    # Latest observation (20% drop -> 800)
    obs2 = PriceObservation(listing_id=listing.id, observed_price=800, observed_at=datetime.utcnow())
    db.add_all([obs1, obs2])
    db.commit()
    
    events = detect_changes(db, listing.id)
    assert len(events) == 1
    event = events[0]
    assert event.event_type == "price_drop"
    assert event.old_value == "1000.0"
    assert event.new_value == "800.0"
    assert event.delta_value == -200.0
    assert event.delta_percent == 20.0
    assert event.severity == "high"

def test_detect_stock_change(db):
    listing = SourceListing(product_id=1, source_url="http://test2.com")
    db.add(listing)
    db.commit()
    
    obs1 = PriceObservation(listing_id=listing.id, observed_price=100, observed_stock_status="in_stock", observed_at=datetime.utcnow() - timedelta(hours=1))
    obs2 = PriceObservation(listing_id=listing.id, observed_price=100, observed_stock_status="out_of_stock", observed_at=datetime.utcnow())
    db.add_all([obs1, obs2])
    db.commit()
    
    events = detect_changes(db, listing.id)
    assert len(events) == 1
    assert events[0].event_type == "stock_changed"
    assert events[0].old_value == "in_stock"
    assert events[0].new_value == "out_of_stock"

# Mock Connector for Integration Tests
class MockConnector(BaseConnector):
    def __init__(self, result: ConnectorResult):
        self.result = result
        
    async def scrape(self, url: str) -> ConnectorResult:
        return self.result

# B. Integration test for the full scrape -> observe -> detect pipeline
@pytest.mark.asyncio
async def test_pipeline_success_event(db, monkeypatch):
    product = Product(name="Pipeline Test")
    db.add(product)
    db.commit()
    listing = SourceListing(product_id=product.id, source_url="http://pipe.com")
    db.add(listing)
    db.commit()
    
    # First valid observation manually inserted
    obs1 = PriceObservation(listing_id=listing.id, observed_price=500, observed_at=datetime.utcnow() - timedelta(hours=1))
    db.add(obs1)
    db.commit()
    
    # Setup mock to return a new price
    mock_res = ConnectorResult(status="success", price=450, title="Pipeline Test")
    monkeypatch.setattr(price_intel.service, "get_connector", lambda url: MockConnector(mock_res))
    
    await run_scrape_for_listing(db, listing)
    
    events = db.query(PriceEvent).filter(PriceEvent.listing_id == listing.id).all()
    assert len(events) == 1
    assert events[0].event_type == "price_drop"
    assert events[0].delta_value == -50.0

# C. Regression test for blocked scrapes
@pytest.mark.asyncio
async def test_blocked_scrape_regression(db, monkeypatch):
    listing = SourceListing(product_id=1, source_url="http://blocked.com")
    db.add(listing)
    db.commit()
    
    # Setup mock to return blocked
    mock_res = ConnectorResult(status="blocked", block_reason="captcha")
    monkeypatch.setattr(price_intel.service, "get_connector", lambda url: MockConnector(mock_res))
    
    await run_scrape_for_listing(db, listing)
    
    # 1. Verify Attempt is written
    attempt = db.query(ScrapeAttempt).filter(ScrapeAttempt.listing_id == listing.id).first()
    assert attempt.status == "blocked"
    assert attempt.block_reason == "captcha"
    
    # 2. Verify NO Observation is written
    obs_count = db.query(PriceObservation).filter(PriceObservation.listing_id == listing.id).count()
    assert obs_count == 0
    
    # 3. Verify scrape_failed Event is written
    events = db.query(PriceEvent).filter(PriceEvent.listing_id == listing.id).all()
    assert len(events) == 1
    assert events[0].event_type == "scrape_failed"
    assert events[0].new_value == "blocked"
