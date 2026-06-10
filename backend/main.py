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
from finetuner import prepare_dataset, start_lora_training_cpu, training_state
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
    chunking_strategy: str = Form("sentence"),
    whisper_model: str = Form("base"),
    use_ocr: bool = Form(False)
):
    try:
        text = ""
        filename = ""
        if url:
            filename = url
            text = parse_youtube(url, model_name=whisper_model)
        elif file:
            filename = file.filename
            content = await file.read()
            text = ingest_file(filename, content, use_ocr=use_ocr, whisper_model=whisper_model)
        else:
            raise HTTPException(status_code=400, detail="Must provide either file or url")
            
        chunks = apply_chunking(text, strategy=chunking_strategy)
        
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
        from analyzer import check_suitability, analyze_quality
        
        if filepath.endswith('.csv'):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_json(filepath, lines=filepath.endswith('.jsonl'))
            
        suitability = check_suitability(df, input_col, output_col)
        quality = analyze_quality(df, input_col, output_col)
        
        return {
            "success": True,
            "suitability": suitability,
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

@app.post("/api/finetune/start")
async def finetune_start(
    filepath: str = Form(...),
    input_col: str = Form(...),
    output_col: str = Form(...),
    model_id: str = Form("HuggingFaceTB/SmolLM-360M-Instruct"),
    batch_size: int = Form(1),
    lr: float = Form(2e-4),
    epochs: int = Form(1),
    lora_rank: int = Form(8),
    target_format: str = Form("chatml"),
    use_eval: bool = Form(True)
):
    try:
        # 1. Prepare Dataset
        dataset = prepare_dataset(filepath, input_col, output_col, target_format)
        
        # 2. Start Background Training
        output_dir = f"./models/adapters/{model_id.split('/')[-1]}_custom"
        start_lora_training_cpu(
            dataset=dataset,
            model_id=model_id,
            batch_size=batch_size,
            lr=lr,
            epochs=epochs,
            lora_rank=lora_rank,
            output_dir=output_dir,
            use_eval=use_eval
        )
        
        # Cleanup temp file
        if os.path.exists(filepath):
            os.remove(filepath)
            
        return {"success": True, "message": "Training started in background."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/finetune/status")
def finetune_status():
    return training_state

@app.get("/api/finetune/export")
def finetune_export():
    import shutil
    import os
    from fastapi.responses import FileResponse
    
    if training_state["is_training"]:
        raise HTTPException(status_code=400, detail="Training is still in progress.")
        
    output_dir = training_state.get("output_dir")
    if not output_dir or not os.path.exists(output_dir):
        raise HTTPException(status_code=404, detail="No trained model found.")
        
    zip_path = f"{output_dir}.zip"
    
    if not os.path.exists(zip_path):
        shutil.make_archive(output_dir, 'zip', output_dir)
        
    return FileResponse(
        path=zip_path,
        filename=os.path.basename(zip_path),
        media_type='application/zip'
    )

class StoreRequest(BaseModel):
    chunks: list
    source: str

class QueryRequest(BaseModel):
    query: str
    n_results: int = 5

@app.post("/api/vector/store")
def vector_store(req: StoreRequest):
    import uuid
    
    # Extract string texts from chunks (some might be objects like {"text": "...", "page": 1})
    documents = []
    for chunk in req.chunks:
        if isinstance(chunk, dict) and 'text' in chunk:
            documents.append(chunk['text'])
        elif isinstance(chunk, str):
            documents.append(chunk)
            
    if not documents:
        return {"success": False, "error": "No valid text documents provided"}
        
    ids = [str(uuid.uuid4()) for _ in documents]
    metadatas = [{"source": req.source} for _ in documents]
    
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    return {"success": True, "inserted": len(documents)}

@app.post("/api/vector/query")
def vector_query(req: QueryRequest):
    results = collection.query(
        query_texts=[req.query],
        n_results=req.n_results
    )
    return {"success": True, "results": results}

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

