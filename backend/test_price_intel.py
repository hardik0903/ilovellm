import requests
import json
import time

API_BASE = "http://localhost:8000/api/price-intel"

print("1. Creating Product...")
p_res = requests.post(f"{API_BASE}/products", json={"name": "Apple iPhone 15", "brand": "Apple", "model": "iPhone 15"})
product = p_res.json()
print("Product:", product)

print("\n2. Tracking Amazon URL (This will scrape)...")
url = "https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY"
t_res = requests.post(f"{API_BASE}/track/{product['id']}", json={"url": url})
listing = t_res.json()
print("Listing:", json.dumps(listing, indent=2))

print("\n3. Fetching History...")
h_res = requests.get(f"{API_BASE}/history/{product['id']}")
history = h_res.json()
print("History entries:", len(history))
for obs in history:
    print(f" - {obs['observed_at']}: {obs['observed_price']} ({obs['observed_stock_status']})")

print("\n4. Dashboard Metrics...")
m_res = requests.get(f"{API_BASE}/dashboard/metrics")
print("Metrics:", m_res.json())
