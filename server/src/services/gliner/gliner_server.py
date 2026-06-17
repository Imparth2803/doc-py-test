from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from gliner import GLiNER
import logging

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

class ExtractResponse(BaseModel):
    persons: list[str]
    organizations: list[str]
    locations: list[str]

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
        return ExtractResponse(persons=[], organizations=[], locations=[])

    # Truncate text to avoid massive memory spikes (GLiNER has context limits, usually ~512-1024 tokens)
    # We will slice roughly 3000 chars to be safe.
    text_slice = text[:3000]

    labels = ["Person", "Organization", "Location"]
    try:
        entities = model.predict_entities(text_slice, labels, threshold=0.4)
        
        persons = []
        organizations = []
        locations = []

        for entity in entities:
            label = entity["label"]
            text_val = entity["text"].strip()
            
            if label == "Person" and text_val not in persons:
                persons.append(text_val)
            elif label == "Organization" and text_val not in organizations:
                organizations.append(text_val)
            elif label == "Location" and text_val not in locations:
                locations.append(text_val)

        return ExtractResponse(
            persons=persons,
            organizations=organizations,
            locations=locations
        )
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail="Internal extraction error")
