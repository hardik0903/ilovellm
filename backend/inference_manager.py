import os
import time
import json
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY is not set in the environment.")

client = AsyncOpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)

GROQ_SYNTHESIS_MODEL = "llama-3.3-70b-versatile"
GROQ_GAP_CHECK_MODEL = "llama-3.1-8b-instant"

async def run_inference(
    artifact_id: str, 
    input_data: str, 
    is_base_model: bool = False, 
    base_model_id: str = GROQ_GAP_CHECK_MODEL, 
    max_tokens: int = 100,
    system_prompt: str = "You are a helpful AI assistant."
):
    """
    Backward-compatible signature. Forwards all requests to Groq API.
    """
    start_time = time.time()
    
    # Use the passed base_model_id if valid, else default to synthesis model if high tokens
    model_to_use = base_model_id if base_model_id in [GROQ_SYNTHESIS_MODEL, GROQ_GAP_CHECK_MODEL] else (GROQ_SYNTHESIS_MODEL if max_tokens > 500 else GROQ_GAP_CHECK_MODEL)

    try:
        response = await client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": input_data}
            ],
            max_tokens=max_tokens,
            temperature=0.0
        )
        
        result_text = response.choices[0].message.content
        latency = time.time() - start_time
        
        return {
            "output": result_text,
            "metrics": {
                "latency_ms": round(latency * 1000),
                "tokens_per_second": "N/A (API)",
                "estimated_cost_per_1k_requests": "N/A (Groq)"
            }
        }
    except Exception as e:
        print(f"Groq API Error: {e}")
        return {
            "output": "Error calling Groq API.",
            "metrics": {
                "latency_ms": 0,
                "tokens_per_second": 0,
                "estimated_cost_per_1k_requests": "$0.0"
            }
        }
