import io
import fitz
import pdfplumber
import pytesseract
from PIL import Image
import pandas as pd
import docx
from bs4 import BeautifulSoup
import whisper
import yt_dlp
import mailparser
import os
import json
import uuid

# Whisper models cache to avoid reloading
_whisper_models = {}

def get_whisper_model(model_name="base"):
    if model_name not in _whisper_models:
        print(f"Loading Whisper model {model_name}...")
        _whisper_models[model_name] = whisper.load_model(model_name)
    return _whisper_models[model_name]

def clear_whisper_cache():
    global _whisper_models
    _whisper_models.clear()
    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

def parse_pdf_text(content: bytes):
    extracted_text = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                extracted_text.append(text)
    return "\n\n".join(extracted_text)

def parse_pdf_ocr(content: bytes):
    extracted_text = []
    doc = fitz.open(stream=content, filetype="pdf")
    for i in range(len(doc)):
        page = doc.load_page(i)
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        text = pytesseract.image_to_string(img)
        if text:
            extracted_text.append(text)
    return "\n\n".join(extracted_text)

def parse_image(content: bytes):
    img = Image.open(io.BytesIO(content))
    return pytesseract.image_to_string(img)

def parse_docx(content: bytes):
    doc = docx.Document(io.BytesIO(content))
    return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

def parse_spreadsheet(content: bytes, extension: str):
    if extension == ".csv":
        df = pd.read_csv(io.BytesIO(content))
    else:
        df = pd.read_excel(io.BytesIO(content))
    return df.to_string()

def parse_html(content: bytes):
    soup = BeautifulSoup(content, 'html.parser')
    return soup.get_text(separator='\n', strip=True)

def parse_json(content: bytes):
    data = json.loads(content.decode('utf-8'))
    return json.dumps(data, indent=2)

def parse_email(content: bytes):
    mail = mailparser.parse_from_bytes(content)
    text = mail.text_plain[0] if mail.text_plain else ""
    if not text and mail.text_html:
        soup = BeautifulSoup(mail.text_html[0], 'html.parser')
        text = soup.get_text(separator='\n', strip=True)
    return text

def parse_audio(content: bytes, model_name: str = "base", filename: str = "temp.mp3"):
    # Write bytes to temp file because whisper requires a file path
    temp_path = f"temp_{uuid.uuid4()}_{filename}"
    with open(temp_path, "wb") as f:
        f.write(content)
        
    try:
        model = get_whisper_model(model_name)
        result = model.transcribe(temp_path)
        return result["text"]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        # To save RAM, clear after each use
        clear_whisper_cache()

def parse_youtube(url: str, model_name: str = "base"):
    temp_path = f"temp_yt_{uuid.uuid4()}.mp3"
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': temp_path.replace('.mp3', '') # yt-dlp adds extension
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        model = get_whisper_model(model_name)
        result = model.transcribe(temp_path)
        return result["text"]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        clear_whisper_cache()

def ingest_file(filename: str, content: bytes, use_ocr: bool = False, whisper_model: str = "base"):
    ext = os.path.splitext(filename.lower())[1]
    
    if ext == ".pdf":
        return parse_pdf_ocr(content) if use_ocr else parse_pdf_text(content)
    elif ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        return parse_image(content)
    elif ext == ".docx":
        return parse_docx(content)
    elif ext in [".xlsx", ".xls", ".csv"]:
        return parse_spreadsheet(content, ext)
    elif ext in [".html", ".htm", ".xml"]:
        return parse_html(content)
    elif ext == ".json":
        return parse_json(content)
    elif ext in [".eml", ".msg"]:
        return parse_email(content)
    elif ext in [".mp3", ".wav", ".m4a", ".ogg", ".flac"]:
        return parse_audio(content, model_name=whisper_model, filename=filename)
    else:
        # Default fallback to decode as utf-8 text
        return content.decode("utf-8", errors="ignore")
