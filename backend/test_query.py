import requests
import json
import time

def run():
    print("Scraping...")
    res = requests.post('http://127.0.0.1:8000/api/scrape/static', json={
        "url": "https://arxiv.org/pdf/2506.00608",
        "force_refresh": False,
        "ignore_robots": True
    }).json()
    
    if not res.get("success"):
        print("Scrape failed", res)
        return
        
    doc_id = res['data']['document_id']
    page_map = res['data']['page_map']
    
    print("Ingesting...")
    res2 = requests.post('http://127.0.0.1:8000/api/ingest-advanced', data={
        "page_map_json": json.dumps(page_map),
        "chunking_strategy": "semantic"
    }).json()
    
    chunks = res2['data']['chunks']
    
    print("Storing...")
    res3 = requests.post('http://127.0.0.1:8000/api/vector/store', json={
        "chunks": chunks,
        "source": "Test",
        "document_id": doc_id
    }).json()
    
    print("Querying Research Endpoint...")
    start = time.time()
    try:
        res4 = requests.post('http://127.0.0.1:8000/api/research/query', json={
            "query": "Name the three specialized collaborative agents that make up the PAKTON tri-agent architecture and briefly define the unique responsibility of each.",
            "document_id": doc_id
        }, timeout=120)
        print("Response:", res4.json())
    except Exception as e:
        print("Query failed:", e)
    print(f"Time taken: {time.time() - start:.2f}s")

if __name__ == "__main__":
    run()
