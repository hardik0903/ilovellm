from sqlalchemy.orm import Session
from datetime import datetime
from .models import Product, SourceListing, PriceObservation, ScrapeAttempt
from .connectors import get_connector
from .normalizer import normalize_listing
from .matcher import find_best_product_match
from .detector import detect_changes

async def track_product_url(db: Session, url: str) -> int:
    """Creates a new tracked product from a URL with Entity Resolution."""
    # 1. Check if URL already tracked
    existing_listing = db.query(SourceListing).filter(SourceListing.source_url == url).first()
    if existing_listing:
        return existing_listing.product_id

    # 2. Scrape immediately to get title and normalize
    connector = get_connector(url)
    result = await connector.scrape(url)
    
    # 3. Entity Resolution Pipeline
    match_product_id = None
    confidence = 0.0
    
    if result.title:
        normalized = normalize_listing(result.title)
        match_result = find_best_product_match(db, normalized)
        
        match_product_id = match_result.match_product_id
        confidence = match_result.match_confidence
        
        # Determine the name for a new product
        product_name = normalized.clean_title
        brand = normalized.brand
        model = normalized.model
    else:
        product_name = url
        brand = None
        model = None
        
    # 4. Resolve Canonical Product
    if match_product_id:
        product_id = match_product_id
    else:
        # Create new product
        product = Product(
            name=product_name,
            brand=brand,
            model=model
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        product_id = product.id

    # 5. Create SourceListing
    listing = SourceListing(
        product_id=product_id,
        source_name="web",
        source_url=url,
        title=result.title or url,
        confidence_score=confidence,
        latest_scrape_status=result.status,
        latest_block_reason=result.block_reason,
        last_seen_at=datetime.utcnow()
    )
    
    if result.status == "success" and result.price is not None:
        listing.current_price = result.price
        listing.mrp = result.mrp
        
    db.add(listing)
    db.commit()
    db.refresh(listing)
    
    # 6. Log ScrapeAttempt & Observation
    attempt = ScrapeAttempt(
        listing_id=listing.id,
        status=result.status,
        block_reason=result.block_reason,
    )
    db.add(attempt)
    
    if result.status == "success" and result.price is not None:
        obs = PriceObservation(
            listing_id=listing.id,
            observed_price=result.price,
            observed_mrp=result.mrp,
            observed_discount_percent=result.discount_percent,
            observed_shipping_cost=result.shipping_cost,
            observed_stock_status=result.availability,
            observed_seller_name=result.seller_name
        )
        db.add(obs)
        
    db.commit()
    
    events = detect_changes(db, listing.id)
    if events:
        db.add_all(events)
        db.commit()
    
    return product_id

async def run_scrape_for_listing(db: Session, listing: SourceListing):
    """Executes a recurring scrape, logs the attempt, and creates an observation if successful."""
    connector = get_connector(listing.source_url)
    result = await connector.scrape(listing.source_url)
    
    listing.latest_scrape_status = result.status
    listing.latest_block_reason = result.block_reason
    listing.last_seen_at = datetime.utcnow()
    
    attempt = ScrapeAttempt(
        listing_id=listing.id,
        status=result.status,
        block_reason=result.block_reason,
    )
    db.add(attempt)
    
    if result.status == "success" and result.price is not None:
        listing.current_price = result.price
        listing.mrp = result.mrp
        listing.discount_percent = result.discount_percent
        listing.shipping_cost = result.shipping_cost
        listing.stock_status = result.availability
        listing.seller_name = result.seller_name
        if result.title:
            listing.title = result.title
        
        obs = PriceObservation(
            listing_id=listing.id,
            observed_price=result.price,
            observed_mrp=result.mrp,
            observed_discount_percent=result.discount_percent,
            observed_shipping_cost=result.shipping_cost,
            observed_stock_status=result.availability,
            observed_seller_name=result.seller_name
        )
        db.add(obs)
        
    db.commit()
    
    events = detect_changes(db, listing.id)
    if events:
        db.add_all(events)
        db.commit()

async def refresh_all_tracked_products(db: Session):
    listings = db.query(SourceListing).all()
    for listing in listings:
        await run_scrape_for_listing(db, listing)
