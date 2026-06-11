from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .db import get_db
from .models import Product, SourceListing, PriceObservation
from .schemas import ProductCreate, ProductResponse, ProductDetailResponse, SourceListingCreate, PriceObservationResponse
from .service import track_product_url, run_scrape_for_listing

router = APIRouter(prefix="/api/price-intel", tags=["price-intel"])

@router.get("/products", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).order_by(Product.created_at.desc()).all()

@router.get("/products/{product_id}", response_model=ProductDetailResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/track/{product_id}")
async def add_source_listing(product_id: int, req: SourceListingCreate, db: Session = Depends(get_db)):
    listing = SourceListing(
        product_id=product_id,
        source_url=req.source_url,
        source_name="web"
    )
    db.add(listing)
    db.commit()
    
    await run_scrape_for_listing(db, listing)
    return {"success": True}

@router.post("/track")
async def track_new_product(req: SourceListingCreate, db: Session = Depends(get_db)):
    product_id = await track_product_url(db, req.source_url)
    # Trigger scrape immediately
    listing = db.query(SourceListing).filter(SourceListing.product_id == product_id).first()
    if listing:
        await run_scrape_for_listing(db, listing)
    return {"success": True, "product_id": product_id}

@router.post("/scrape/run/{listing_id}")
async def manual_scrape(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(SourceListing).filter(SourceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    await run_scrape_for_listing(db, listing)
    return {"success": True}

@router.get("/history/{product_id}", response_model=List[PriceObservationResponse])
def get_price_history(product_id: int, db: Session = Depends(get_db)):
    listings = db.query(SourceListing).filter(SourceListing.product_id == product_id).all()
    listing_ids = [l.id for l in listings]
    
    observations = db.query(PriceObservation).filter(
        PriceObservation.listing_id.in_(listing_ids)
    ).order_by(PriceObservation.observed_at.asc()).all()
    
    return observations

@router.get("/dashboard/metrics")
def get_metrics(db: Session = Depends(get_db)):
    return {
        "total_products": db.query(Product).count(),
        "active_listings": db.query(SourceListing).count(),
        "price_drops_24h": 0 # MVP placeholder
    }

@router.get("/debug/{listing_id}")
def debug_listing(listing_id: int, db: Session = Depends(get_db)):
    from .models import PriceEvent
    listing = db.query(SourceListing).filter(SourceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
        
    latest_obs = db.query(PriceObservation).filter(
        PriceObservation.listing_id == listing_id
    ).order_by(PriceObservation.observed_at.desc()).first()
    
    latest_attempt = db.query(ScrapeAttempt).filter(
        ScrapeAttempt.listing_id == listing_id
    ).order_by(ScrapeAttempt.attempted_at.desc()).first()
    
    latest_event = db.query(PriceEvent).filter(
        PriceEvent.listing_id == listing_id
    ).order_by(PriceEvent.detected_at.desc()).first()
    
    return {
        "listing": {
            "id": listing.id,
            "status": listing.latest_scrape_status,
            "price": listing.current_price
        },
        "latest_observation": latest_obs,
        "latest_attempt": latest_attempt,
        "latest_event": latest_event
    }
