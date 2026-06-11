from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from typing import List, Optional
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()
from typing import List, Optional, Dict
import fitz  # PyMuPDF
import pdfplumber
import base64
import io
import os
import json
import re
import pickle
import zipfile
import httpx
import chromadb
from chromadb.utils import embedding_functions
from rank_bm25 import BM25Okapi
from ingester import ingest_file, parse_youtube
from chunker import apply_chunking
from duckduckgo_search import DDGS
from scraper import scrape_static, scrape_dynamic, scrape_authenticated, init_browser, close_browser
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

# price_intel removed

# Initialize ChromaDB with BGE embeddings for scientific text
chroma_client = chromadb.PersistentClient(path="./chroma_storage")
bge_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="BAAI/bge-small-en-v1.5"
)
collection = chroma_client.get_or_create_collection(
    name="ilovellm_documents_v2",
    embedding_function=bge_ef
)

# ==========================================
# BM25 + HYBRID RETRIEVAL UTILITIES
# ==========================================
os.makedirs("./bm25_cache", exist_ok=True)
INDEX_REGISTRY_PATH = "./bm25_cache/index_registry.json"

def _load_index_registry() -> dict:
    if os.path.exists(INDEX_REGISTRY_PATH):
        with open(INDEX_REGISTRY_PATH, "r") as f:
            return json.load(f)
    return {}

def _save_index_registry(registry: dict):
    with open(INDEX_REGISTRY_PATH, "w") as f:
        json.dump(registry, f)

def build_bm25_index(chunks: list, document_id: str):
    """Build and persist a BM25 index for a document."""
    texts = [c if isinstance(c, str) else c.get("text", "") for c in chunks]
    texts = [t for t in texts if t.strip()]
    if not texts:
        return
    tokenized = [t.lower().split() for t in texts]
    bm25 = BM25Okapi(tokenized)
    with open(f"./bm25_cache/{document_id}.pkl", "wb") as f:
        pickle.dump((bm25, texts), f)
    # Update registry
    registry = _load_index_registry()
    registry[document_id] = {"chunk_count": len(texts), "indexed": True}
    _save_index_registry(registry)

def hybrid_retrieve(query: str, document_id: str, top_k: int = 6):
    """Hybrid BM25 + Dense retrieval with Reciprocal Rank Fusion."""
    # Dense retrieval
    dense_res = collection.query(
        query_texts=[query], n_results=min(10, top_k * 2),
        where={"document_id": document_id},
        include=["documents", "metadatas", "distances"]
    )
    dense_docs = dense_res.get("documents", [[]])[0]
    dense_metas = dense_res.get("metadatas", [[]])[0]
    dense_dists = dense_res.get("distances", [[]])[0]
    dense_rrf = {doc: 1.0 / (i + 1) for i, doc in enumerate(dense_docs)}

    # BM25 retrieval
    bm25_path = f"./bm25_cache/{document_id}.pkl"
    bm25_rrf = {}
    if os.path.exists(bm25_path):
        with open(bm25_path, "rb") as f:
            bm25, all_chunks = pickle.load(f)
        raw_scores = bm25.get_scores(query.lower().split())
        top_idx = sorted(range(len(raw_scores)), key=lambda i: -raw_scores[i])[:10]
        bm25_rrf = {all_chunks[i]: 1.0 / (rank + 1) for rank, i in enumerate(top_idx)}

    # RRF merge
    all_doc_set = set(dense_rrf) | set(bm25_rrf)
    rrf_scores = {d: dense_rrf.get(d, 0) + bm25_rrf.get(d, 0) for d in all_doc_set}
    sorted_docs = sorted(rrf_scores, key=lambda d: -rrf_scores[d])[:top_k]

    # Build metadata lookup from dense results
    meta_lookup = {doc: meta for doc, meta in zip(dense_docs, dense_metas)}
    result_metas = [meta_lookup.get(d, {}) for d in sorted_docs]

    # Determine if second pass needed via cosine distance threshold
    needs_second_pass = bool(dense_dists and dense_dists[0] > 0.55)
    return sorted_docs, result_metas, needs_second_pass

def trim_to_token_budget(docs: list, max_chars: int = 4000) -> list:
    """Hard cap on total context length to prevent CPU attention explosion."""
    trimmed = []
    total = 0
    for doc in docs:
        if total + len(doc) > max_chars:
            remaining = max_chars - total
            if remaining > 100:
                trimmed.append(doc[:remaining] + "...")
            break
        trimmed.append(doc)
        total += len(doc)
    return trimmed

jobstores = {
    'default': SQLAlchemyJobStore(url='sqlite:///scraper_jobs.db')
}
scheduler = AsyncIOScheduler(jobstores=jobstores)

from price_intel.db import Base, engine, get_db, SessionLocal
from price_intel.routes import router as price_intel_router

def run_refresh_sync():
    import asyncio
    from price_intel.service import refresh_all_tracked_products
    db = SessionLocal()
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(refresh_all_tracked_products(db))
        else:
            loop.run_until_complete(refresh_all_tracked_products(db))
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Initializing Database Schemas...")
    Base.metadata.create_all(bind=engine)
    await init_browser()
    
    # Schedule Price Intel job
    scheduler.add_job(
        run_refresh_sync,
        'interval',
        minutes=30,
        id='price_intel_refresh',
        replace_existing=True,
        misfire_grace_time=60
    )
    
    scheduler.start()
    yield
    # Shutdown
    scheduler.shutdown()
    await close_browser()

app = FastAPI(title="ilovellm Advanced Ingestion Service", lifespan=lifespan)
app.include_router(price_intel_router)

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
def status():
    return {"status": "ok", "service": "ilovellm-backend-python", "capabilities": ["tables", "images", "text", "playwright-scraper"]}

class ScrapeRequestBase(BaseModel):
    url: str
    force_refresh: bool = False
    ignore_robots: bool = False

class AuthScrapeRequest(ScrapeRequestBase):
    cookies: List[Dict]

@app.post("/api/scrape/static")
async def api_scrape_static(req: ScrapeRequestBase):
    result = await scrape_static(req.url, req.force_refresh, req.ignore_robots)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@app.post("/api/scrape/dynamic")
async def api_scrape_dynamic(req: ScrapeRequestBase):
    result = await scrape_dynamic(req.url, req.force_refresh, req.ignore_robots)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@app.post("/api/scrape/authenticated")
async def api_scrape_authenticated(req: AuthScrapeRequest):
    result = await scrape_authenticated(req.url, req.cookies, req.force_refresh, req.ignore_robots)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

class ScheduleRequest(BaseModel):
    url: str
    cron: str
    mode: str = "static" # static, dynamic, or authenticated
    cookies: Optional[List[Dict]] = None
    ignore_robots: bool = False

@app.post("/api/scrape/schedule")
async def api_schedule(req: ScheduleRequest):
    from apscheduler.triggers.cron import CronTrigger
    try:
        trigger = CronTrigger.from_crontab(req.cron)
        if req.mode == "static":
            target_func = scrape_static
            args = [req.url, True, req.ignore_robots]
        elif req.mode == "dynamic":
            target_func = scrape_dynamic
            args = [req.url, True, req.ignore_robots]
        elif req.mode == "authenticated":
            target_func = scrape_authenticated
            args = [req.url, req.cookies, True, req.ignore_robots]
        else:
            raise ValueError("Invalid mode")

        job = scheduler.add_job(
            target_func, 
            trigger=trigger, 
            args=args, 
            id=f"job_{req.mode}_{req.url}",
            replace_existing=True
        )
        return {"success": True, "job_id": job.id, "next_run_time": str(job.next_run_time)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to schedule: {str(e)}")

class DownloadMediaRequest(BaseModel):
    urls: List[str]

@app.post("/api/scrape/download-media")
async def api_download_media(req: DownloadMediaRequest):
    if not req.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    
    zip_buffer = io.BytesIO()
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for i, url in enumerate(req.urls):
                try:
                    filename = url.split("/")[-1].split("?")[0]
                    if not filename or len(filename) > 50:
                        filename = f"media_{i}.jpg"
                    
                    if url.startswith("data:"):
                        import base64
                        header, encoded = url.split(",", 1)
                        data = base64.b64decode(encoded)
                        
                        # try to get extension from header
                        ext = ".jpg"
                        if "image/png" in header: ext = ".png"
                        elif "image/svg" in header: ext = ".svg"
                        elif "image/gif" in header: ext = ".gif"
                        
                        filename = f"media_{i}{ext}"
                        zip_file.writestr(filename, data)
                        continue

                    # Ensure valid extension for unknown types
                    if "." not in filename[-6:]:
                        filename += ".jpg"
                        
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        zip_file.writestr(filename, resp.content)
                except Exception:
                    pass
                    
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=scraped_media.zip"}
    )

@app.post("/api/ingest-advanced")
async def ingest_advanced(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    page_map_json: Optional[str] = Form(None),
    chunking_strategy: str = Form("semantic"),
    whisper_model: str = Form("base"),
    use_ocr: bool = Form(False)
):
    try:
        import json
        text = ""
        filename = ""
        chunks = []
        
        if page_map_json:
            page_map = json.loads(page_map_json)
            for page_data in page_map:
                page_chunks = apply_chunking(page_data['text'], strategy=chunking_strategy)
                for c in page_chunks:
                    if isinstance(c, dict):
                        c["page"] = page_data['page']
                        chunks.append(c)
                    else:
                        chunks.append({"text": c, "page": page_data['page']})
            filename = url if url else "page_map_document"
        else:
            if url:
                filename = url
                text = parse_youtube(url, model_name=whisper_model)
            elif file:
                filename = file.filename
                content = await file.read()
                text = ingest_file(filename, content, use_ocr=use_ocr, whisper_model=whisper_model)
            else:
                raise HTTPException(status_code=400, detail="Must provide either file, url, or page_map_json")
                
            raw_chunks = apply_chunking(text, strategy=chunking_strategy)
            chunks = [c if isinstance(c, dict) else {"text": c} for c in raw_chunks]
        
        return {
            "success": True,
            "data": {
                "filename": filename,
                "strategy": chunking_strategy,
                "total_chunks": len(chunks),
                "chunks": chunks
            }
        }
    except Exception as e:
        print(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# FINE-TUNING ENDPOINTS
# ==========================================

@app.post("/api/finetune/upload")
async def finetune_upload(file: UploadFile = File(...)):
    # Save the file temporarily
    temp_path = f"temp_dataset_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    
    # Read the columns to send back to the UI for mapping
    try:
        import pandas as pd
        if temp_path.endswith('.csv'):
            df = pd.read_csv(temp_path)
        elif temp_path.endswith('.json') or temp_path.endswith('.jsonl'):
            df = pd.read_json(temp_path, lines=temp_path.endswith('.jsonl'))
        else:
            raise ValueError("Unsupported file format. Use CSV or JSONL.")
            
        columns = df.columns.tolist()
        
        # Give a preview of the first 3 rows
        preview = []
        df_preview = df.fillna("").head(3)
        for _, row in df_preview.iterrows():
            preview.append(row.to_dict())
            
        return {
            "success": True, 
            "columns": columns, 
            "filepath": temp_path, 
            "total_rows": len(df),
            "preview": preview
        }
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/finetune/analyze")
async def finetune_analyze(
    filepath: str = Form(...),
    input_col: str = Form(...),
    output_col: str = Form(...)
):
    try:
        import pandas as pd
        from analyzer import generate_training_plan, analyze_quality
        
        if filepath.endswith('.csv'):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_json(filepath, lines=filepath.endswith('.jsonl'))
            
        training_plan = generate_training_plan(df, input_col, output_col)
        quality = analyze_quality(df, input_col, output_col)
        
        return {
            "success": True,
            "training_plan": training_plan,
            "quality": quality
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/finetune/convert")
async def finetune_convert(
    filepath: str = Form(...),
    input_col: str = Form(...),
    output_col: str = Form(...),
    target_format: str = Form(...)
):
    try:
        import pandas as pd
        from analyzer import convert_to_training_format
        
        if filepath.endswith('.csv'):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_json(filepath, lines=filepath.endswith('.jsonl'))
            
        preview = convert_to_training_format(df, input_col, output_col, target_format)
        
        return {
            "success": True,
            "preview": preview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/finetune/label")
async def finetune_label(
    filepath: str = Form(...),
    input_col: str = Form(...),
    output_col: str = Form(...)
):
    try:
        import pandas as pd
        from analyzer import suggest_labels
        
        if filepath.endswith('.csv'):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_json(filepath, lines=filepath.endswith('.jsonl'))
            
        result = suggest_labels(df, input_col, output_col)
        
        if "error" in result:
            return {"success": False, "detail": result["error"]}
            
        return {
            "success": True,
            "suggestions": result["suggestions"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/finetune/execute")
async def finetune_execute(
    filepath: str = Form(...),
    input_col: str = Form(...),
    output_col: str = Form(...),
    plan_json: str = Form(...)  # User passes back the approved plan JSON string
):
    try:
        import json
        from queue_manager import enqueue_job
        
        plan = json.loads(plan_json)
        
        if not plan.get("should_train", True):
            return {"success": False, "message": "Plan specifies no training should occur. Execution aborted."}
            
        if plan.get("execution_mode") == "manual_review":
            return {"success": False, "message": "This dataset requires manual review and cannot be executed automatically."}
            
        # Queue the job instead of running inline
        job_id = enqueue_job(filepath, input_col, output_col, plan)
            
        return {"success": True, "message": "Job queued successfully.", "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/finetune/status")
def finetune_status(job_id: str):
    from queue_manager import get_job_status
    status = get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found.")
    return status

@app.get("/api/finetune/export")
def finetune_export(job_id: str):
    import os
    from fastapi.responses import FileResponse
    from queue_manager import get_artifact_by_job, get_job_status
    
    status = get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job is not completed yet.")
        
    artifact = get_artifact_by_job(job_id)
    if not artifact or not os.path.exists(artifact["artifact_path"]):
        raise HTTPException(status_code=404, detail="No output artifact found for this job.")
        
    return FileResponse(
        path=artifact["artifact_path"],
        filename=os.path.basename(artifact["artifact_path"]),
        media_type='application/zip'
    )

class StoreRequest(BaseModel):
    chunks: list
    source: str
    document_id: Optional[str] = None

class QueryRequest(BaseModel):
    query: str
    n_results: int = 5

@app.post("/api/vector/store")
def vector_store(req: StoreRequest):
    import uuid
    
    # Check embedding cache — skip if already indexed
    if req.document_id:
        registry = _load_index_registry()
        if req.document_id in registry and registry[req.document_id].get("indexed"):
            return {"success": True, "inserted": 0, "cached": True, "message": "Document already indexed."}
    
    documents = []
    metadatas = []
    for i, chunk in enumerate(req.chunks):
        if isinstance(chunk, dict) and 'text' in chunk:
            documents.append(chunk['text'])
            meta = {"source": req.source, "chunk_index": i}
            if req.document_id: meta["document_id"] = req.document_id
            if 'page' in chunk: meta["page"] = chunk['page']
            if 'word_start' in chunk: meta["word_start"] = chunk['word_start']
            if 'word_end' in chunk: meta["word_end"] = chunk['word_end']
            metadatas.append(meta)
        elif isinstance(chunk, str):
            documents.append(chunk)
            meta = {"source": req.source, "chunk_index": i}
            if req.document_id: meta["document_id"] = req.document_id
            metadatas.append(meta)
            
    if not documents:
        return {"success": False, "error": "No valid text documents provided"}
        
    ids = [str(uuid.uuid4()) for _ in documents]
    
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    
    # Build BM25 index alongside dense storage
    if req.document_id:
        build_bm25_index(documents, req.document_id)
    
    return {"success": True, "inserted": len(documents)}

class QueryRequest(BaseModel):
    query: str
    n_results: int = 10
    document_id: Optional[str] = None

@app.post("/api/vector/query")
def vector_query(req: QueryRequest):
    kwargs = {
        "query_texts": [req.query],
        "n_results": req.n_results
    }
    if req.document_id:
        kwargs["where"] = {"document_id": req.document_id}
        
    results = collection.query(**kwargs)
    return {"success": True, "results": results}

class ResearchQueryRequest(BaseModel):
    query: str
    document_id: str

def _format_numbered_evidence(docs, metas):
    """Format chunks as numbered evidence blocks for traceable citations."""
    blocks = []
    for i, (doc, meta) in enumerate(zip(docs, metas)):
        page = meta.get("page", "?")
        truncated = doc[:1500]
        blocks.append(f'[{i+1}] Page {page}: "{truncated}"')
    return "\n\n".join(blocks)

SYNTHESIS_PROMPT = """You are a research paper analyst. Answer ONLY from the numbered evidence passages below.
If the answer is not in the passages, reply with this exact JSON and nothing else:
{{
  "answer": "Not found in the paper.",
  "evidence": [],
  "confidence": 0.0,
  "found_in_paper": false,
  "relevant_pages": []
}}

Evidence:
{evidence}

Question: {question}

Reply with ONLY valid JSON in this exact format, with no markdown fences or other text:
{{
  "answer": "complete answer here",
  "evidence": ["direct quote or paraphrase from text"],
  "confidence": 0.8,
  "found_in_paper": true,
  "relevant_pages": [1, 2]
}}"""

def _parse_groq_json(raw_output: str) -> dict:
    import json
    import re
    try:
        return json.loads(raw_output)
    except Exception:
        # Fallback: strip markdown fences
        try:
            stripped = re.sub(r'^```json\s*', '', raw_output.strip(), flags=re.IGNORECASE)
            stripped = re.sub(r'\s*```$', '', stripped)
            return json.loads(stripped)
        except Exception:
            return {
                "parse_error": True,
                "answer": raw_output,
                "confidence": 0.0,
                "found_in_paper": False,
                "relevant_pages": [],
                "evidence": []
            }

@app.post("/api/research/query")
async def research_query(req: ResearchQueryRequest):
    from inference_manager import run_inference, GROQ_GAP_CHECK_MODEL, GROQ_SYNTHESIS_MODEL
    
    docs, metas, _ = hybrid_retrieve(req.query, req.document_id, top_k=8)
    
    evidence_text = _format_numbered_evidence(docs, metas)
    gap_prompt = f"Query: {req.query}\n\nEvidence:\n{evidence_text}\n\nDo you have enough evidence to answer? Reply ONLY 'YES' or 'NO: <missing search terms>'."
    gap_check = await run_inference(
        artifact_id="base", input_data=gap_prompt, 
        base_model_id=GROQ_GAP_CHECK_MODEL, max_tokens=150
    )
    gap_text = gap_check["output"].strip()
    
    interrogation_passes = 1
    if gap_text.upper().startswith("NO"):
        missing_query = gap_text[3:].strip()
        if missing_query:
            extra_docs, extra_metas, _ = hybrid_retrieve(missing_query, req.document_id, top_k=4)
            existing = set(docs)
            for d, m in zip(extra_docs, extra_metas):
                if d not in existing and len(docs) < 12:
                    docs.append(d)
                    metas.append(m)
                    existing.add(d)
            interrogation_passes = 2
            
    # Re-format evidence with up to 12 chunks
    evidence_text = _format_numbered_evidence(docs, metas)
    syn_prompt = SYNTHESIS_PROMPT.format(evidence=evidence_text, question=req.query)
    
    syn_res = await run_inference(
        artifact_id="base", input_data=syn_prompt,
        base_model_id=GROQ_SYNTHESIS_MODEL, max_tokens=1024
    )
    raw_output = syn_res["output"]
    parsed = _parse_groq_json(raw_output)
    
    return {
        "success": True,
        "data": parsed,
        "interrogation_passes": interrogation_passes,
        "metrics": syn_res.get("metrics", {})
    }

@app.post("/api/research/query/stream")
async def research_query_stream(req: ResearchQueryRequest):
    from inference_manager import run_inference, GROQ_GAP_CHECK_MODEL, GROQ_SYNTHESIS_MODEL
    import asyncio
    import json
    
    async def event_stream():
        yield f'data: {{"phase": "retrieving"}}\n\n'
        
        docs, metas, _ = hybrid_retrieve(req.query, req.document_id, top_k=8)
        
        evidence_text = _format_numbered_evidence(docs, metas)
        gap_prompt = f"Query: {req.query}\n\nEvidence:\n{evidence_text}\n\nDo you have enough evidence to answer? Reply ONLY 'YES' or 'NO: <missing search terms>'."
        gap_check = await run_inference(
            artifact_id="base", input_data=gap_prompt, 
            base_model_id=GROQ_GAP_CHECK_MODEL, max_tokens=150
        )
        gap_text = gap_check["output"].strip()
        
        if gap_text.upper().startswith("NO"):
            yield f'data: {{"phase": "second_pass"}}\n\n'
            missing_query = gap_text[3:].strip()
            if missing_query:
                extra_docs, extra_metas, _ = hybrid_retrieve(missing_query, req.document_id, top_k=4)
                existing = set(docs)
                for d, m in zip(extra_docs, extra_metas):
                    if d not in existing and len(docs) < 12:
                        docs.append(d)
                        metas.append(m)
                        existing.add(d)
        
        yield f'data: {{"phase": "generating"}}\n\n'
        
        evidence_text = _format_numbered_evidence(docs, metas)
        syn_prompt = SYNTHESIS_PROMPT.format(evidence=evidence_text, question=req.query)
        
        syn_res = await run_inference(
            artifact_id="base", input_data=syn_prompt,
            base_model_id=GROQ_SYNTHESIS_MODEL, max_tokens=1024
        )
        raw_output = syn_res["output"]
        parsed = _parse_groq_json(raw_output)
        
        yield f'data: {json.dumps({"phase": "complete", "data": parsed})}\n\n'
        
    from fastapi.responses import StreamingResponse
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    })

class SearchRequest(BaseModel):
    query: str
    max_results: int = 10

@app.post("/api/search")
def web_search(req: SearchRequest):
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(req.query, max_results=req.max_results):
                results.append(r)
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ==========================================
# PRICE INTELLIGENCE ENDPOINTS
# ==========================================

app.include_router(price_intel_router)
