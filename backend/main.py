from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from typing import List, Optional
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from typing import List, Optional, Dict
import fitz  # PyMuPDF
import pdfplumber
import base64
import io
import os
import zipfile
import httpx
import chromadb
from ingester import ingest_file, parse_youtube
from chunker import apply_chunking
from duckduckgo_search import DDGS
from scraper import scrape_static, scrape_dynamic, scrape_authenticated, init_browser, close_browser
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

# Initialize ChromaDB local storage
chroma_client = chromadb.PersistentClient(path="./chroma_storage")
collection = chroma_client.get_or_create_collection(name="ilovellm_documents")

jobstores = {
    'default': SQLAlchemyJobStore(url='sqlite:///scraper_jobs.db')
}
scheduler = AsyncIOScheduler(jobstores=jobstores)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_browser()
    scheduler.start()
    yield
    # Shutdown
    scheduler.shutdown()
    await close_browser()

app = FastAPI(title="ilovellm Advanced Ingestion Service", lifespan=lifespan)

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
            chunks = [{"text": c} for c in raw_chunks]
        
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
    
    documents = []
    metadatas = []
    for i, chunk in enumerate(req.chunks):
        if isinstance(chunk, dict) and 'text' in chunk:
            documents.append(chunk['text'])
            meta = {"source": req.source, "chunk_index": i}
            if req.document_id: meta["document_id"] = req.document_id
            if 'page' in chunk: meta["page"] = chunk['page']
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

@app.post("/api/research/query")
async def research_query(req: ResearchQueryRequest):
    from inference_manager import run_inference
    import json
    import re
    
    def format_context(docs, metas):
        blocks = []
        for i, (doc, meta) in enumerate(zip(docs, metas)):
            page = meta.get("page", "?")
            blocks.append(f"Chunk {i+1} [Page {page}]:\n{doc}")
        return "\n\n".join(blocks)

    # 1. Initial Retrieval
    initial_res = collection.query(
        query_texts=[req.query], n_results=5, where={"document_id": req.document_id}
    )
    docs = initial_res.get("documents", [[]])[0]
    metas = initial_res.get("metadatas", [[]])[0]
    
    # 2. Gap-Check Pass
    gap_prompt = f"Query: {req.query}\n\nEvidence:\n{format_context(docs, metas)}\n\nDo you have enough evidence to answer? Reply ONLY 'YES' or 'NO: <missing search terms>'."
    
    gap_check = await run_inference(
        artifact_id="base", input_data=gap_prompt, is_base_model=True, base_model_id="Qwen/Qwen2.5-0.5B-Instruct"
    )
    gap_text = gap_check["output"].strip()
    
    # 3. Second Retrieval if needed
    if gap_text.upper().startswith("NO"):
        missing_query = gap_text[3:].strip()
        sec_res = collection.query(
            query_texts=[missing_query], n_results=5, where={"document_id": req.document_id}
        )
        # Append unique chunks
        existing_docs = set(docs)
        for d, m in zip(sec_res.get("documents", [[]])[0], sec_res.get("metadatas", [[]])[0]):
            if d not in existing_docs:
                docs.append(d)
                metas.append(m)
                existing_docs.add(d)

    # 4. Synthesize
    syn_prompt = f"""You are a strict AI Researcher. Answer the user's query based ONLY on the evidence below.
You MUST output YOUR ENTIRE RESPONSE as a valid JSON object exactly like this:
{{
  "answer": "Your detailed answer",
  "evidence": "Exact quotes from the text",
  "citations": "Chunk X, Page Y",
  "confidence": "High/Medium/Low",
  "abstain_reason": "If you cannot answer it, explain why here. Otherwise empty string."
}}

If the evidence does NOT contain the answer, you MUST set "answer" to "Not found in the paper." and fill "abstain_reason".
Do NOT output anything outside the JSON block.

Evidence Context:
{format_context(docs, metas)}

User Query: {req.query}"""

    syn_res = await run_inference(
        artifact_id="base", input_data=syn_prompt, is_base_model=True, base_model_id="Qwen/Qwen2.5-0.5B-Instruct"
    )
    raw_output = syn_res["output"]
    
    # 5. Validate / Parse JSON
    parsed_json = None
    try:
        match = re.search(r'(\{.*?\})', raw_output.replace('\n', ''), re.DOTALL)
        if match:
            parsed_json = json.loads(match.group(1))
        else:
            parsed_json = json.loads(raw_output)
    except Exception:
        parsed_json = {
            "answer": raw_output,
            "evidence": "N/A",
            "citations": "N/A",
            "confidence": "Low",
            "abstain_reason": "Failed to parse structured output."
        }
        
    return {"success": True, "data": parsed_json, "interrogation_passes": 2 if gap_text.upper().startswith("NO") else 1}

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

