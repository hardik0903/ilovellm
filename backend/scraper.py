import asyncio
import hashlib
import sqlite3
import json
import time
import httpx
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Browser, Playwright
import uuid
import io
import pdfplumber

# Initialize SQLite Cache for Change Detection
conn = sqlite3.connect('scraper_cache.db', check_same_thread=False)
cursor = conn.cursor()
cursor.execute('''
    CREATE TABLE IF NOT EXISTS page_cache (
        url TEXT PRIMARY KEY,
        content_hash TEXT,
        last_scraped REAL,
        structured_data TEXT
    )
''')
conn.commit()

# Global Browser Pool
_playwright: Playwright = None
_browser: Browser = None

async def init_browser():
    global _playwright, _browser
    if not _playwright:
        _playwright = await async_playwright().start()
    if _browser and not _browser.is_connected():
        _browser = None
    if not _browser:
        _browser = await _playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )

async def close_browser():
    global _playwright, _browser
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None

# Robots.txt cache
_robot_parsers = {}

async def is_allowed_by_robots(url: str, user_agent: str = "*") -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    
    if robots_url not in _robot_parsers:
        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(robots_url)
                if resp.status_code == 200:
                    rp.parse(resp.text.splitlines())
        except Exception:
            pass # Default to allowed if robots.txt is missing/unreachable
        _robot_parsers[robots_url] = rp
        
    return _robot_parsers[robots_url].can_fetch(user_agent, url)

def get_cached_result(url: str):
    cursor.execute('SELECT content_hash, structured_data, last_scraped FROM page_cache WHERE url = ?', (url,))
    row = cursor.fetchone()
    if row:
        return {
            "content_hash": row[0],
            "structured_data": json.loads(row[1]),
            "last_scraped": row[2]
        }
    return None

def update_cache(url: str, content_hash: str, structured_data: dict):
    cursor.execute('''
        INSERT INTO page_cache (url, content_hash, last_scraped, structured_data)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET 
            content_hash=excluded.content_hash,
            last_scraped=excluded.last_scraped,
            structured_data=excluded.structured_data
    ''', (url, content_hash, time.time(), json.dumps(structured_data)))
    conn.commit()

from urllib.parse import urljoin

def parse_html(html: str, base_url: str = "") -> dict:
    soup = BeautifulSoup(html, 'html.parser')
    
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    
    title = soup.title.string if soup.title else ""
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    description = meta_desc['content'] if meta_desc and 'content' in meta_desc.attrs else ""
    
    images = []
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src')
        if src and not src.startswith('data:image'):
            images.append({"src": urljoin(base_url, src), "alt": img.get('alt', '')})
            
    videos = []
    for vid in soup.find_all('video'):
        src = vid.get('src')
        if not src:
            source = vid.find('source')
            if source:
                src = source.get('src')
        if src:
            videos.append({"src": urljoin(base_url, src), "poster": urljoin(base_url, vid.get('poster', '')) if vid.get('poster') else ''})
            
    context = []
    for tag in soup.find_all(['h1', 'h2', 'h3', 'p', 'article']):
        text = tag.get_text(strip=True)
        if text:
            context.append({"tag": tag.name, "text": text})
            
    links = []
    for a in soup.find_all('a'):
        href = a.get('href')
        text = a.get_text(strip=True)
        if href and text:
            # We filter out JS handlers, but keep http/https or relative paths
            if not href.startswith('javascript:'):
                links.append({"href": urljoin(base_url, href), "text": text})
            
    def dedupe(lst):
        seen = set()
        res = []
        for d in lst:
            t = tuple(d.items())
            if t not in seen:
                seen.add(t)
                res.append(d)
        return res

    extracted_text = "\n".join([c["text"] for c in context])

    return {
        "title": title.strip() if title else "",
        "description": description.strip(),
        "bytes": len(html),
        "images": dedupe(images),
        "videos": dedupe(videos),
        "context": context,
        "links": dedupe(links),
        "extracted_text": extracted_text,
        "page_map": [{"page": 1, "text": extracted_text}],
        "source_type": "html",
        "content_type": "text/html",
        "url": base_url,
        "document_id": str(uuid.uuid4())
    }

async def _check_robots_and_cache(url: str, force_refresh: bool, ignore_robots: bool = False):
    if not ignore_robots:
        allowed = await is_allowed_by_robots(url)
        if not allowed:
            return {"success": False, "error": "Scraping blocked by robots.txt"}, None

    cached = get_cached_result(url)
    return None, cached

async def scrape_static(url: str, force_refresh: bool = False, ignore_robots: bool = False):
    """ Service 1: Static Website Scraping """
    err, cached = await _check_robots_and_cache(url, force_refresh, ignore_robots)
    if err: return err

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        try:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            content_type = resp.headers.get("Content-Type", "").lower()
            
            # PDF HANDLING
            if "application/pdf" in content_type or url.lower().endswith(".pdf"):
                content_hash = hashlib.sha256(resp.content).hexdigest()
                if not force_refresh and cached and cached["content_hash"] == content_hash:
                    return {"success": True, "cached": True, "mode": "static", "data": cached["structured_data"]}
                
                extracted_text = []
                page_map = []
                with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
                    for i, page in enumerate(pdf.pages):
                        text = page.extract_text()
                        if text:
                            extracted_text.append(text)
                            page_map.append({"page": i + 1, "text": text})
                            
                structured_data = {
                    "title": url.split("/")[-1],
                    "description": "PDF Document",
                    "bytes": len(resp.content),
                    "images": [],
                    "videos": [],
                    "context": [{"tag": "p", "text": t} for t in extracted_text],
                    "links": [],
                    "extracted_text": "\n\n".join(extracted_text),
                    "page_map": page_map,
                    "source_type": "pdf",
                    "content_type": "application/pdf",
                    "url": url,
                    "document_id": str(uuid.uuid4())
                }
                update_cache(url, content_hash, structured_data)
                return {"success": True, "cached": False, "mode": "static", "data": structured_data}
                
            static_html = resp.text
        except Exception as e:
            return {"success": False, "error": f"Failed static fetch: {str(e)}"}

    content_hash = hashlib.sha256(static_html.encode('utf-8')).hexdigest()
    if not force_refresh and cached and cached["content_hash"] == content_hash:
        return {"success": True, "cached": True, "mode": "static", "data": cached["structured_data"]}

    structured_data = parse_html(static_html, base_url=url)
    update_cache(url, content_hash, structured_data)
    return {"success": True, "cached": False, "mode": "static", "data": structured_data}

async def scrape_dynamic(url: str, force_refresh: bool = False, ignore_robots: bool = False):
    """ Service 1: Dynamic Website Scraping """
    err, cached = await _check_robots_and_cache(url, force_refresh, ignore_robots)
    if err: return err

    return await _run_playwright(url, force_refresh, cached, None, "dynamic")

async def scrape_authenticated(url: str, cookies: list, force_refresh: bool = False, ignore_robots: bool = False):
    """ Service 1: Authenticated Scraping """
    err, cached = await _check_robots_and_cache(url, force_refresh, ignore_robots)
    if err: return err

    return await _run_playwright(url, force_refresh, cached, cookies, "authenticated")

async def _run_playwright(url: str, force_refresh: bool, cached: dict, cookies: list, mode: str):
    global _browser
    if not _browser or not _browser.is_connected():
        await init_browser()
        
    context = None
    page = None
    
    try:
        context = await _browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        if cookies:
            for c in cookies:
                if 'url' not in c and 'domain' not in c:
                    c['url'] = url
                if 'sameSite' in c:
                    s = str(c['sameSite']).lower()
                    if s in ['no_restriction', 'none']:
                        c['sameSite'] = 'None'
                    elif s == 'lax':
                        c['sameSite'] = 'Lax'
                    elif s == 'strict':
                        c['sameSite'] = 'Strict'
                    else:
                        del c['sameSite']
            await context.add_cookies(cookies)
            
        page = await context.new_page()
        
        # async def route_intercept(route):
        #     if route.request.resource_type in ["font", "stylesheet", "media"]:
        #         await route.abort()
        #     else:
        #         await route.continue_()
                
        # await page.route("**/*", route_intercept)
        
        max_retries = 3
        backoff = 1
        for attempt in range(max_retries):
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            if resp and resp.status in [403, 429] and attempt < max_retries - 1:
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            break
            
        await page.evaluate("""
            async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight - window.innerHeight || totalHeight > 10000){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            }
        """)
        
        dynamic_html = await page.content()
        dynamic_hash = hashlib.sha256(dynamic_html.encode('utf-8')).hexdigest()
        
        if not force_refresh and cached and cached["content_hash"] == dynamic_hash:
            return {"success": True, "cached": True, "mode": mode, "data": cached["structured_data"]}
            
        structured_data = parse_html(dynamic_html, base_url=url)
        update_cache(url, dynamic_hash, structured_data)
        
        return {
            "success": True,
            "cached": False,
            "mode": mode,
            "data": structured_data
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if page:
            await page.close()
        if context:
            await context.close()
