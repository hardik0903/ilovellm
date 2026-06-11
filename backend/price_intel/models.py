from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from price_intel.db import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(String, index=True, nullable=True)
    name = Column(String, index=True)
    brand = Column(String, nullable=True)
    model = Column(String, nullable=True)
    sku = Column(String, nullable=True)
    gtin = Column(String, nullable=True)
    target_price = Column(Float, nullable=True)
    floor_price = Column(Float, nullable=True)
    ceiling_price = Column(Float, nullable=True)
    min_margin_percent = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    listings = relationship("SourceListing", back_populates="product", cascade="all, delete-orphan")

class SourceListing(Base):
    __tablename__ = "source_listings"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    source_name = Column(String, index=True)  # 'amazon', 'flipkart', etc.
    source_url = Column(String, unique=True, index=True)
    source_listing_id = Column(String, nullable=True)
    
    title = Column(String)
    seller_name = Column(String, nullable=True)
    
    current_price = Column(Float, nullable=True)
    mrp = Column(Float, nullable=True)
    discount_percent = Column(Float, nullable=True)
    shipping_cost = Column(Float, nullable=True)
    currency = Column(String, default="INR")
    
    rating = Column(Float, nullable=True)
    review_count = Column(Integer, nullable=True)
    stock_status = Column(String, nullable=True)
    
    # Scrape Health
    latest_scrape_status = Column(String, nullable=True) # success, blocked, captcha, rate_limited, parse_failed
    latest_block_reason = Column(String, nullable=True)
    confidence_score = Column(Float, nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product", back_populates="listings")
    observations = relationship("PriceObservation", back_populates="listing", cascade="all, delete-orphan")
    attempts = relationship("ScrapeAttempt", back_populates="listing", cascade="all, delete-orphan")

class PriceObservation(Base):
    __tablename__ = "price_observations"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("source_listings.id"))
    
    observed_price = Column(Float)
    observed_mrp = Column(Float, nullable=True)
    observed_discount_percent = Column(Float, nullable=True)
    observed_shipping_cost = Column(Float, nullable=True)
    observed_stock_status = Column(String, nullable=True)
    observed_seller_name = Column(String, nullable=True)
    
    observed_at = Column(DateTime(timezone=True), server_default=func.now())
    raw_snapshot_json = Column(JSON, nullable=True)

    listing = relationship("SourceListing", back_populates="observations")

class ScrapeAttempt(Base):
    __tablename__ = "scrape_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("source_listings.id"))
    
    status = Column(String) # success, blocked, captcha, rate_limited, parse_failed, no_product_found, error
    block_reason = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())
    response_hash = Column(String, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    
    listing = relationship("SourceListing", back_populates="attempts")

class PriceEvent(Base):
    __tablename__ = "price_events"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    listing_id = Column(Integer, ForeignKey("source_listings.id"))
    
    event_type = Column(String, index=True)  # price_drop, price_increase, stock_changed, seller_changed, scrape_failed
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    
    delta_value = Column(Float, nullable=True)
    delta_percent = Column(Float, nullable=True)
    
    severity = Column(String, nullable=True) # low, medium, high
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    metadata_json = Column(JSON, nullable=True)

    listing = relationship("SourceListing")
    product = relationship("Product")
