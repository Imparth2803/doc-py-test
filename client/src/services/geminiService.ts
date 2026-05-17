import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { FOLDER_TEMPLATES } from "../types";

export interface AIAnalysisResult {
  docName: string;
  entities: string[];
  folder: string;
  tags: string[];
  confidence: 'HIGH' | 'LOW';
  metadata: {
    documentNumber?: string;
    expiryDate?: string;
    issueDate?: string;
    issuer?: string;
    amount?: string;
    currency?: string;
  };
  metrics?: {
    pages?: number;
    languages?: string[];
    ocrPerformed?: boolean;
    complexity?: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning?: string;
  };
}

export async function analyzeDocumentWithGemini(
  base64Data: string, 
  mimeType: string, 
  fileName?: string, 
  existingEntities: string[] = []
): Promise<AIAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Clean = base64Data.includes(',') ? base64Data.substring(base64Data.indexOf(',') + 1) : base64Data;
  const entitiesList = existingEntities.length > 0 ? existingEntities.join(", ") : "none";

  const prompt = `Analyze this document. Extract the exact specific Entity name(s) this document refers to (e.g., "Tejas", "11-year-old Son", "Ahmedabad Residence", "Acme Corp"). 
  
  Entities already known: [${entitiesList}]. Prefer these if they match.
  
  Categorize into one of these folders: ${JSON.stringify(FOLDER_TEMPLATES)}.
  
  Return strict JSON with:
  'docName': Clean formal name.
  'entities': Array of strings.
  'folder': One of the folder names.
  'tags': 4-6 keywords.
  'confidence': 'HIGH' or 'LOW'.
  'metadata': { 'documentNumber', 'expiryDate', 'issueDate', 'issuer', 'amount', 'currency' }.
  'metrics': { 'pages', 'languages', 'ocrPerformed', 'complexity', 'reasoning' }.`;

  try {
    console.log("Sending request to Gemini model... mimeType:", mimeType);
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Clean } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            docName: { type: Type.STRING },
            entities: { type: Type.ARRAY, items: { type: Type.STRING } },
            folder: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence: { type: Type.STRING },
            metadata: {
              type: Type.OBJECT,
              properties: {
                documentNumber: { type: Type.STRING },
                expiryDate: { type: Type.STRING },
                issueDate: { type: Type.STRING },
                issuer: { type: Type.STRING },
                amount: { type: Type.STRING },
                currency: { type: Type.STRING }
              }
            },
            metrics: {
              type: Type.OBJECT,
              properties: {
                pages: { type: Type.NUMBER },
                languages: { type: Type.ARRAY, items: { type: Type.STRING } },
                ocrPerformed: { type: Type.BOOLEAN },
                complexity: { type: Type.STRING },
                reasoning: { type: Type.STRING }
              }
            }
          },
          required: ["docName", "entities", "folder", "tags", "confidence", "metadata"]
        }
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response text");
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    return JSON.parse(text) as AIAnalysisResult;

  } catch (error: any) {
    console.error("Gemini Analysis Primary Failure:", error);
    
    // Fallback: Filename analysis
    if (fileName) {
       try {
         const fallbackResponse = await ai.models.generateContent({
           model: "gemini-3-flash-preview",
           contents: `Extract info from filename: "${fileName}". \n\n ${prompt}`,
           config: {
             responseMimeType: "application/json",
             responseSchema: {
               type: Type.OBJECT,
               properties: {
                 docName: { type: Type.STRING },
                 entities: { type: Type.ARRAY, items: { type: Type.STRING } },
                 folder: { type: Type.STRING },
                 tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                 confidence: { type: Type.STRING },
                 metadata: { type: Type.OBJECT }
               },
               required: ["docName", "entities", "folder", "tags", "confidence"]
             }
           }
         });
         
         let fbText = fallbackResponse.text;
         if (fbText) {
             fbText = fbText.replace(/```json/gi, "").replace(/```/g, "").trim();
             return JSON.parse(fbText) as AIAnalysisResult;
         }
       } catch (fbErr) {
         console.error("Fallback failure:", fbErr);
       }
    }

    throw new Error(`Neural processing failed: ${error.message || "Unknown error"}. Please check your connection or try a different file.`);
  }
}
