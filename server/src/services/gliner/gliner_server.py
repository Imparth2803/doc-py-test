from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from gliner import GLiNER
import logging
from typing import List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GLiNER_Service")

app = FastAPI(title="GLiNER Entity Extraction Service")

# Initialize model globally
# Using small model to avoid memory pressure alongside OCR and Docling
model_name = "urchade/gliner_small-v2.1"
logger.info(f"Loading GLiNER model: {model_name} on CPU...")
try:
    model = GLiNER.from_pretrained(model_name, device="cpu")
    logger.info("GLiNER model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load GLiNER model: {e}")
    model = None

class ExtractRequest(BaseModel):
    text: str

class DetailedEntity(BaseModel):
    text: str
    label: str
    confidence: float

class ExtractResponse(BaseModel):
    persons: List[str]
    organizations: List[str]
    locations: List[str]
    raw_entities: List[DetailedEntity]
    chunk_count: int

@app.get("/health")
def health_check():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "ok", "model": model_name}

@app.post("/extract-entities", response_model=ExtractResponse)
def extract_entities(req: ExtractRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    text = req.text
    if not text or not text.strip():
        return ExtractResponse(
            persons=[], organizations=[], locations=[], raw_entities=[], chunk_count=0
        )

    # Issue 2: Replace 3000 Character Truncation with Chunking
    chunk_size = 2500
    overlap = 200
    chunks = []
    
    if len(text) <= chunk_size:
        chunks.append(text)
    else:
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append(text[start:end])
            if end == len(text):
                break
            start += chunk_size - overlap

    labels = ["Person", "Organization", "Location"]
    all_entities = {}

    try:
        for chunk in chunks:
            # Predict entities for this chunk
            entities = model.predict_entities(chunk, labels, threshold=0.4)
            
            for entity in entities:
                label = entity["label"]
                text_val = entity["text"].strip()
                score = entity["score"]
                
                key = (label, text_val)
                # Deduplicate, keeping the highest confidence score
                if key not in all_entities or all_entities[key]["score"] < score:
                    all_entities[key] = {
                        "text": text_val,
                        "label": label,
                        "score": score
                    }
        
        persons = []
        organizations = []
        locations = []
        raw_entities = []

        for key, entity in all_entities.items():
            label = entity["label"]
            text_val = entity["text"]
            
            raw_entities.append(DetailedEntity(
                text=text_val,
                label=label,
                confidence=entity["score"]
            ))
            
            if label == "Person":
                persons.append(text_val)
            elif label == "Organization":
                organizations.append(text_val)
            elif label == "Location":
                locations.append(text_val)

        return ExtractResponse(
            persons=persons,
            organizations=organizations,
            locations=locations,
            raw_entities=raw_entities,
            chunk_count=len(chunks)
        )
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail="Internal extraction error")
