from price_intel.db import engine, Base
from price_intel.models import ScrapeAttempt
import sqlite3

def migrate():
    # 1. Add columns to source_listings
    conn = sqlite3.connect("price_intel.db")
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE source_listings ADD COLUMN latest_scrape_status VARCHAR;")
    except sqlite3.OperationalError as e:
        print("Column latest_scrape_status already exists or error:", e)
        
    try:
        cursor.execute("ALTER TABLE source_listings ADD COLUMN latest_block_reason VARCHAR;")
    except sqlite3.OperationalError as e:
        print("Column latest_block_reason already exists or error:", e)
        
    conn.commit()
    conn.close()

    # 2. Create ScrapeAttempt table
    Base.metadata.create_all(bind=engine)
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
