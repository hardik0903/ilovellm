import re
import httpx
from bs4 import BeautifulSoup
from .base import BaseConnector, ConnectorResult

class AmazonConnector(BaseConnector):
    async def scrape(self, url: str) -> ConnectorResult:
        try:
            # Using httpx for a quick fetch. In a real system, use Playwright or Node stealth proxy.
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=headers)
                
            html = response.text
            
            # 1. CAPTCHA / Bot detection
            if "To discuss automated access to Amazon data please contact" in html or "Type the characters you see in this image" in html:
                return ConnectorResult(status="blocked", block_reason="captcha")
                
            soup = BeautifulSoup(html, "html.parser")
            
            # 2. Parse Title
            title_el = soup.select_one("#productTitle")
            title = title_el.get_text(strip=True) if title_el else None
            
            if not title:
                return ConnectorResult(status="no_product_found")
                
            # 3. Parse Price
            price_el = soup.select_one(".a-price-whole") or soup.select_one("#priceblock_ourprice")
            price = None
            if price_el:
                price_str = price_el.get_text(strip=True).replace(',', '').replace('₹', '').replace('.', '')
                try:
                    price = float(price_str)
                except ValueError:
                    pass
                    
            if price is None:
                return ConnectorResult(status="parse_failed", title=title)
                
            # 4. Parse MRP
            mrp_el = soup.select_one(".a-text-price .a-offscreen")
            mrp = None
            if mrp_el:
                mrp_str = mrp_el.get_text(strip=True).replace(',', '').replace('₹', '')
                try:
                    mrp = float(mrp_str)
                except ValueError:
                    pass
            
            return ConnectorResult(
                status="success",
                title=title,
                price=price,
                mrp=mrp,
                currency="INR"
            )
            
        except Exception as e:
            return ConnectorResult(status="error", block_reason=str(e))
