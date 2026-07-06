from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from gliner import GLiNER
import logging
from typing import List, Optional
import re
from indic_transliteration import sanscript


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
    start: int
    end: int

class ExtractResponse(BaseModel):
    persons: List[str]
    organizations: List[str]
    raw_entities: List[DetailedEntity]
    chunk_count: int

@app.get("/health")
def health_check():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "ok", "model": model_name}

def preprocess_indic_text(text: str) -> str:
    if not text:
        return ""
    
    # Check for Devanagari and Gujarati characters
    has_devanagari = bool(re.search(r'[\u0900-\u097F]', text))
    has_gujarati = bool(re.search(r'[\u0A80-\u0AFF]', text))
    
    # Return English text untouched, preserving original case and characters
    if not has_devanagari and not has_gujarati:
        return text

    # Transliterate to ITRANS
    if has_devanagari:
        text = sanscript.transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
    if has_gujarati:
        text = sanscript.transliterate(text, sanscript.GUJARATI, sanscript.ITRANS)
        
    # Standardize V -> W
    text = text.replace('v', 'w').replace('V', 'W')
    
    # Strip internal and trailing schwa vowels
    consonants = "[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]"
    
    # Trailing schwa: word longer than 3 characters ending in 'a'
    text = re.sub(r'\b([a-zA-Z\.\~]{3,})a\b', r'\1', text)
    
    # Internal schwa: consonant + 'a' + consonant + 'e' (or 'o') at the end of a word
    text = re.sub(rf'\b([a-zA-Z\.\~]*{consonants})a({consonants}[eo])\b', r'\1\2', text)
    
    # Force output to uppercase
    return text.upper()

@app.post("/extract-entities", response_model=ExtractResponse)
def extract_entities(req: ExtractRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    text = preprocess_indic_text(req.text)
    if not text or not text.strip():
        return ExtractResponse(
            persons=[], organizations=[], raw_entities=[], chunk_count=0
        )

    # Issue 2: Replace 3000 Character Truncation with Chunking
    chunk_size = 2500
    overlap = 200
    chunks = []
    
    if len(text) <= chunk_size:
        chunks.append((0, text))
    else:
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append((start, text[start:end]))
            if end == len(text):
                break
            start += chunk_size - overlap

    labels = ["Person", "Organization"]
    all_entities = {}

    try:
        for chunk_start, chunk in chunks:
            # Predict entities for this chunk
            entities = model.predict_entities(chunk, labels, threshold=0.4)
            
            for entity in entities:
                label = entity["label"]
                text_val = entity["text"].strip()
                score = entity["score"]
                abs_start = chunk_start + entity["start"]
                abs_end = chunk_start + entity["end"]
                
                key = (label, text_val)
                # Deduplicate, keeping the highest confidence score
                if key not in all_entities or all_entities[key]["score"] < score:
                    all_entities[key] = {
                        "text": text_val,
                        "label": label,
                        "score": score,
                        "start": abs_start,
                        "end": abs_end
                    }
        
        persons = []
        organizations = []
        raw_entities = []

        for key, entity in all_entities.items():
            label = entity["label"]
            text_val = entity["text"]
            
            raw_entities.append(DetailedEntity(
                text=text_val,
                label=label,
                confidence=entity["score"],
                start=entity["start"],
                end=entity["end"]
            ))
            
            if label == "Person":
                persons.append(text_val)
            elif label == "Organization":
                organizations.append(text_val)

        return ExtractResponse(
            persons=persons,
            organizations=organizations,
            raw_entities=raw_entities,
            chunk_count=len(chunks)
        )
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail="Internal extraction error")
