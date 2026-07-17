import axios from 'axios';
import { getOllamaUrl } from '../../config/serviceUrls';
import { cleanAndValidateFilename } from '../../utils/filenameUtils';

export interface LocalDocumentAnalysis {
  summary: string;
  tags: string[];
  suggestedFilename: string;
  category: string;
  summaryFields: Record<string, string>; // 🚀 NEW: Matches Gemini's flattened structure
  diagnostics: {
    model: string;
    latencyMs: number;
    success: boolean;
    truncated: boolean;
    generatedTagCount: number;
    filenameGenerated: boolean;
    summaryGenerated: boolean;
    error?: string;
    provider?: string;
    timestamp?: string;
  };
}

const LOCAL_ANALYSIS_MODEL = process.env.LOCAL_ANALYSIS_MODEL || "qwen2.5:1.5b";
const LOCAL_ANALYSIS_TIMEOUT_MS = parseInt(process.env.LOCAL_ANALYSIS_TIMEOUT_MS || "90000", 10);

const MAP_REDUCE_THRESHOLD_CHARS = 12000; 
const CHUNK_SIZE_CHARS = 6000; 

const splitTextIntoChunks = (text: string, size: number): string[] => {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.join(' ').length >= size) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));
  return chunks;
};

export const analyzeDocumentLocally = async (
  text: string,
  category?: string,
  entities?: string[],
  metadata?: any
): Promise<LocalDocumentAnalysis> => {
  const startTime = Date.now();
  const ollamaUrl = getOllamaUrl();
  
  let executedMapReduce = false;
  let summaryContext = "";

  if (!text || text.trim().length === 0) {
    console.log(`[🚀 HYBRID GATE] Skip AI processing: Empty OCR text.`);
    return {
      summary: "",
      tags: [],
      suggestedFilename: "",
      category: "Other",
      summaryFields: {},
      diagnostics: {
        model: LOCAL_ANALYSIS_MODEL,
        latencyMs: 0,
        success: false,
        truncated: false,
        generatedTagCount: 0,
        filenameGenerated: false,
        summaryGenerated: false,
        error: "Skip AI processing: Empty OCR text.",
        provider: "local",
        timestamp: new Date().toISOString()
      }
    };
  }

  // Phase 6 - Health Check
  try {
    const healthResponse = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
    if (healthResponse.data && Array.isArray(healthResponse.data.models)) {
      const models = healthResponse.data.models.map((m: any) => m.name.toLowerCase());
      const isModelAvailable = models.some((name: string) => 
        name === LOCAL_ANALYSIS_MODEL.toLowerCase() || 
        name.startsWith(LOCAL_ANALYSIS_MODEL.toLowerCase() + ":") ||
        LOCAL_ANALYSIS_MODEL.toLowerCase().startsWith(name + ":")
      );
      if (!isModelAvailable) {
        throw new Error(`Required model '${LOCAL_ANALYSIS_MODEL}' is not installed. Available: ${models.join(', ')}`);
      }
    } else {
      throw new Error(`Ollama returned invalid tags payload.`);
    }
  } catch (err: any) {
    return {
      summary: "",
      tags: [],
      suggestedFilename: "",
      category: "Other",
      summaryFields: {},
      diagnostics: {
        model: LOCAL_ANALYSIS_MODEL,
        latencyMs: Date.now() - startTime,
        success: false,
        truncated: false,
        generatedTagCount: 0,
        filenameGenerated: false,
        summaryGenerated: false,
        error: `Ollama health check failed: ${err.message}`,
        provider: "local",
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    // --- PHASE 1: CHUNKING & MAP PASS ---
    if (text.length >= MAP_REDUCE_THRESHOLD_CHARS) {
      console.log(`[🚀 HYBRID GATE] Text length (${text.length} chars). Executing MapReduce...`);
      executedMapReduce = true;
      const chunks = splitTextIntoChunks(text, CHUNK_SIZE_CHARS);
      const intermediateSummaries: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const mapPrompt = `System:
You are a factual parsing engine. Extract all primary events, monetary transactions, key entities, dates, identifiers, and a bulleted overview of the following document segment. Do not speculate or infer.

User (Segment ${i + 1} of ${chunks.length}):
${chunks[i]}`;

        const mapResponse = await axios.post(
          `${ollamaUrl}/api/generate`,
          {
            model: LOCAL_ANALYSIS_MODEL,
            prompt: mapPrompt,
            stream: false,
            options: { temperature: 0.1, num_predict: 256 }
          },
          { timeout: LOCAL_ANALYSIS_TIMEOUT_MS }
        );

        if (mapResponse.data?.response) {
          intermediateSummaries.push(`--- Segment ${i + 1} Overview ---\n${mapResponse.data.response.trim()}`);
        }
      }
      summaryContext = intermediateSummaries.join("\n\n");
    } else {
      console.log(`[⚡ HYBRID GATE] Text length (${text.length} chars). Executing Single Pass...`);
      summaryContext = text;
    }

    // --- PHASE 2: REDUCE PASS WITH STRUCTURED SUMMARYFIELDS ---
    const finalPrompt = `System:
You are a document analysis engine. Analyze the text content and return valid JSON only.
Use only information explicitly present in the supplied document text or summaries.
Do not infer facts or speculate.

JSON Format:
{
  "summary": "2-4 concise sentences summarizing the document context seamlessly.",
  "tags": ["3 to 10 lowercase, search-oriented tags"],
  "suggestedFilename": "Human-readable filename max 80 chars",
  "category": "One of: Resume, Degree Certificate, Passport, Aadhaar, PAN Card, Driving License, Bank Statement, Salary Slip, Invoice, Receipt, GST Certificate, Property Agreement, Insurance Policy, Electricity Bill, Water Bill, Medical Record, Tax Document, Business Registration, Other",
  "summaryFields": [
    {"key": "Field Name", "value": "Extracted Value"}
  ]
}

For summaryFields:
You MUST extract structured facts whenever they are present.
For Electricity Bills, Water Bills, Bank Statements, Invoices, Receipts, Insurance Policies, Salary Slips, Tax Documents and Financial Documents, summaryFields should almost never be empty.

For Filename suggestedFilename field:
Follow these strict rules to ensure the filename is human-readable, consistent, concise, and meaningful:
1. REQUIRED FILENAME FORMAT STRUCTURE:
   <Entity Name> <Organisation Name> <Date | Month | Year>
   - "Entity Name" = Primary person or organization the document belongs to. Never invent.
   - "Organisation Name" = The actual issuing authority (e.g., "TJSB Bank", "HDFC Bank", "Passport Office", "Apollo Hospital"). Avoid generic terms like "Bank", "Company", "Government".
   - "Date / Month / Year" = Optional. Only include when it meaningfully distinguishes the document (e.g. monthly bank statements, invoices, salary slips, tax returns, bills, insurance statements). Do NOT include dates for Passports, Aadhaar Cards, PAN Cards, Driving Licenses, Birth/Marriage Certificates, or Degree Certificates.
2. GENERATION PRIORITY:
   1. Primary Entity Name
   2. Organisation Name
   3. Document Type (only when needed for clarity)
   4. Date / Month / Year (only when meaningful)
3. NEVER USE UPLOADED FILENAMES OR TECHNICAL ARTIFACTS:
   - The uploaded filename must NEVER influence the generated filename. Completely ignore values like "E_STATEMENT_...", "IMG_...", "SCAN...", "Document.pdf", "WhatsApp Image...".
   - The generated filename must NEVER contain: random numbers, internal/customer/reference/transaction IDs, UUIDs, OCR garbage, upload timestamps, scanner names, duplicate indicators like "(1)" or "(2)", long numeric date ranges like "20260501_20260531", hashes, or technical prefixes like "IMG", "SCAN", "DOC", "FILE", "E_STATEMENT".
4. FORMATTING & LENGTH:
   - Use natural Title Case.
   - Do NOT use underscores, excessive punctuation, or technical formatting.
   - Length: 3 to 7 meaningful words. Maximum approximately 80 characters.
   - If you cannot confidently identify the Entity Name, Organisation Name, or Date, omit the uncertain information. A shorter but accurate filename is always preferred.

Examples (illustrative only — do not infer missing information)

Available:
Person = Sarah Johnson
Organization = HDFC Bank
Date = May 2026
Document Type = Bank Statement

Filename:
Sarah Johnson HDFC Bank Statement May 2026


Available:
Person = Michael Chen
Organization = —
Date = —
Document Type = Passport

Filename:
Michael Chen Passport


Available:
Person = Priya Sharma
Organization = UIDAI
Date = —
Document Type = Aadhaar Card

Filename:
Priya Sharma UIDAI Aadhaar Card


Available:
Person = David Wilson
Organization = Apollo Hospital
Date = 12 March 2026
Document Type = Medical Report

Filename:
David Wilson Apollo Hospital Medical Report 12 March 2026


Available:
Person = —
Organization = ABC Industries
Date = FY 2024–2025
Document Type = GST Return

Filename:
ABC Industries GST Return FY 2024–2025


Available:
Person = —
Organization = Tata Motors
Date = 15 March 2026
Document Type = Invoice

Filename:
Tata Motors Invoice 15 March 2026


Available:
Person = Emily Brown
Organization = —
Date = 2025
Document Type = Degree Certificate

Filename:
Emily Brown Degree Certificate 2025


Available:
Person = —
Organization = —
Date = May 2026
Document Type = Bank Statement

Filename:
Bank Statement May 2026


Tags:
- Use 7 to 10 lowercase, search-oriented tags.
- Avoid generic tags like 'document', 'file', 'paper', 'scan', 'image', 'pdf'.
- Include tags for document type, organization, and key entities.

Priorities:
- Electricity/Water Bills: Amount Upto Due Date, Amount After Due Date, Bill Due Date, Bill Date, Consumer Number, Meter Number, Units Consumed.
- Bank Statements: Account Number, Statement Period, Opening Balance, Closing Balance.
- Invoices/Receipts: Invoice Number, Invoice Date, Due Date, Total Amount.

CRITICAL: If you mention a value inside the summary, that value must also appear in summaryFields.
Minimum: 4 fields when structured information exists. Maximum: 15 fields.

User:
Category Target: ${category || 'Unknown'}
Extracted Entities: ${entities && entities.length > 0 ? entities.join(', ') : 'None'}
Original Filename: ${metadata?.fileName || 'Unknown'}
Language Hint: ${metadata?.language || 'en'}
MIME Type: ${metadata?.mimeType || 'Unknown'}
OCR Confidence: ${metadata?.ocrConfidence !== undefined ? metadata.ocrConfidence : 'Unknown'}

Document Text Content:
${summaryContext}`;

    const response = await axios.post(
      `${ollamaUrl}/api/generate`,
      {
        model: LOCAL_ANALYSIS_MODEL,
        prompt: finalPrompt,
        stream: false,
        keep_alive: "5m",
        format: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            suggestedFilename: { type: "string" },
            category: { type: "string" },
            summaryFields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  value: { type: "string" }
                },
                required: ["key", "value"]
              }
            }
          },
          required: ["summary", "tags", "suggestedFilename", "category", "summaryFields"]
        },
        options: {
          num_predict: 768, // Expanded slightly to account for the array parsing block
          temperature: 0.0
        }
      },
      { timeout: LOCAL_ANALYSIS_TIMEOUT_MS }
    );

    const latencyMs = Date.now() - startTime;
    let responseText = response.data.response?.trim() || "{}";
    responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    let parsed: any = {};
    try { parsed = JSON.parse(responseText); } catch (e) { console.warn(`[PARSE_WARN] JSON failed: ${e}`); }

    // --- CLEANUP, TRANSFORMATION & PARITY FLATTENING ---
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : "";
    let tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: any) => typeof t === 'string').map((t: string) => t.toLowerCase().trim()) : [];
    const badTags = ['document', 'file', 'paper', 'scan', 'image', 'pdf'];
    tags = Array.from(new Set(tags.filter((t: string) => !badTags.includes(t) && t.length > 0)));

    let suggestedFilename = typeof parsed.suggestedFilename === 'string' ? parsed.suggestedFilename.trim() : "";
    suggestedFilename = cleanAndValidateFilename(suggestedFilename, metadata?.fileName, parsed.category || category);

    let categoryResult = typeof parsed.category === 'string' ? parsed.category.trim() : "Other";

    // 🚀 NEW: Flattens the array back to a Record<string, string> map to achieve full interface parity with geminiProvider.ts
    const summaryFieldMap = Object.fromEntries(
      (parsed.summaryFields || []).map(
        ({ key, value }: any) => [String(key).trim(), String(value).trim()]
      )
    );

    return {
      summary,
      tags,
      suggestedFilename,
      category: categoryResult,
      summaryFields: summaryFieldMap, // Fully normalized map payload
      diagnostics: {
        model: LOCAL_ANALYSIS_MODEL,
        latencyMs,
        success: true,
        truncated: executedMapReduce, 
        generatedTagCount: tags.length,
        filenameGenerated: suggestedFilename.length > 0,
        summaryGenerated: summary.length > 0
      }
    };

  } catch (error: any) {
    console.warn(`[LOCAL_ANALYSIS_WARN] Error: ${error.message}`);
    return {
      summary: "",
      tags: [],
      suggestedFilename: "",
      category: "Other",
      summaryFields: {}, // Safe structural fallback map
      diagnostics: {
        model: LOCAL_ANALYSIS_MODEL,
        latencyMs: Date.now() - startTime,
        success: false,
        truncated: executedMapReduce,
        generatedTagCount: 0,
        filenameGenerated: false,
        summaryGenerated: false,
        error: error.message,
        provider: "local",
        timestamp: new Date().toISOString()
      }
    };
  }
};