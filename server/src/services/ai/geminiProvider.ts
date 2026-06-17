import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from './types'; 
import { AIQuotaExceededError } from './errors';
import { IAIProvider } from './aiProvider';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
    },
    category: {
      type: Type.STRING,
    },
    tags: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },
    suggestedFilename: {
      type: Type.STRING,
    },
    rotation: {
      type: Type.NUMBER,
    },
    summaryFields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          value: { type: Type.STRING }
        },
        required: ["key", "value"]
      }
    },
  },
  required: ["summary", "category", "tags", "entities", "suggestedFilename", "rotation","summaryFields"],
};

const getBasePrompt = (fileName: string) => `
Analyze this document content.

Filename: ${fileName}

Extract only PRIMARY STAKEHOLDERS as entities.
- A stakeholder is a person, company, organization, institution, bank, university, employer, government body, or legal entity that owns, receives, issues, or is responsible for the document.
- Prefer document owner and issuing organization over all other entities.
- For handwritten documents, if stakeholders are unclear: Extract the most likely person, organization, institution, or location. Only use contextual entities when no proper stakeholder exists.
- Do NOT include generic document topics (e.g., "Invoice", "Receipt", "Prescription") in the entities field; these belong in tags or category.
- Do not return empty entities or tags unless the document is completely unreadable.
- Maximum 5 entities.

Choose ONE document type from the following list and store in "category":

Resume
Degree Certificate
Passport
Aadhaar
PAN Card
Driving License
Bank Statement
Salary Slip
Invoice
Receipt
GST Certificate
Property Agreement
Insurance Policy
Electricity Bill
Water Bill
Medical Record
Tax Document
Business Registration
Other

Generate a meaningful filename.

Rules:
- Maximum 60 characters
- No file extension
- Human readable
- Include document type when relevant
- Include person or organization name when available

Generate 3-10 tags.
Rules:
- Produce meaningful search-oriented tags.
- Prefer document purpose, category, topic, industry, and context.

For summaryFields:

You MUST extract structured facts whenever they are present.

For Electricity Bills, Water Bills, Bank Statements, Invoices, Receipts, Insurance Policies, Salary Slips, Tax Documents and Financial Documents, summaryFields should almost never be empty.

For an Electricity Bill prioritize:

Amount Upto Due Date
Amount After Due Date
Bill Due Date
Bill Date
Units Consumed
Meter Number
Consumer Number / BP Number
Last Payment Date
Last Paid Amount

For Bank Statements prioritize:

Account Number
Statement Period
Opening Balance
Closing Balance

For Invoices prioritize:

Invoice Number
Invoice Date
Due Date
Total Amount

Do NOT return an empty object if any monetary amount, date, identifier, reference number, reading, unit count, account number, invoice number, policy number, meter number, balance, or payment information is present.

CRITICAL:
If you mention a value inside the summary, that value must also appear in summaryFields.

Return all important structured fields that can be confidently extracted.

Minimum: 4 fields when structured information exists.
Maximum: 15 fields.

Example:

{
  "summaryFields": [
    {
      "key": "Bill Due Date",
      "value": "07-06-2023"
    },
    {
      "key": "Amount Upto Due Date",
      "value": "3530"
    }
  ]
}

VALIDATION CHECK:

Before returning JSON:
1. Count all dates in the document.
2. Count all amounts in the document.
3. Count all account numbers, invoice numbers, policy numbers, meter numbers, consumer numbers, or reference numbers.

If any of these exist:
summaryFields MUST contain the most important ones.
If summaryFields is empty while such values exist,the response is incorrect and must be regenerated.

Return ONLY JSON:
{
  "summary":"",
  "category":"",
  "tags":[],
  "entities":[],
  "suggestedFilename":"",
  "rotation": 0,
  "summaryFields": [{"key": "Field Name", "value": "Value"}]
}
`;

const cleanAndParseGeminiResponse = (text: string): AIAnalysisResult => {
  const cleanedText = text?.replace(/```json/gi, "").replace(/```/g, "").trim();
  if (!cleanedText) throw new Error("Empty AI Response");

  const result = JSON.parse(cleanedText);

  // Convert summaryFields array back to record map for consistency
  const summaryFieldMap = Object.fromEntries(
    (result.summaryFields || []).map(
      ({ key, value }: any) => [key, String(value)]
    )
  );

  result.summaryFields = summaryFieldMap;
  return result;
};

export class GeminiProvider implements IAIProvider {
  async analyzeText(text: string, fileName: string): Promise<AIAnalysisResult> {
    console.log("=== GEMINI TEXT REQUEST ===");
    console.log("File:", fileName);
    console.log("Text Length:", text.length);

    const promptText = `
${getBasePrompt(fileName)}

NOTE: Since this is raw text input, visual rotation is not applicable. Always return "rotation": 0.

Document Text Content:
${text.slice(0, 30000)}
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash", // Use 2.0 Flash for text
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      console.log("=== GEMINI TEXT RESPONSE ===");
      const result = cleanAndParseGeminiResponse(response.text ?? "");
      return result;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const message = error?.message || "";
      
      if (status === 429 || message.toLowerCase().includes("quota exceeded")) {
        console.error("Gemini Quota Exceeded (Text):", message);
        throw new AIQuotaExceededError();
      }

      console.error("Gemini Text AI Error:", error);
      throw error;
    }
  }

  async analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<AIAnalysisResult> {
    console.log("=== GEMINI VISION REQUEST ===");
    console.log("File:", fileName);
    console.log("Mime:", mimeType);
    console.log("Base64 Length:", base64Data.length);

    const promptText = `
${getBasePrompt(fileName)}

Determine whether the uploaded document image truly requires rotation.

Return "rotation" as only one of:
0
90
180
270

Definitions:
0 = already upright and readable
90 = document is rotated right and requires a 90° counter-clockwise correction
180 = document is upside down
270 = document is rotated left and requires a 90° clockwise correction

CRITICAL ROTATION SAFETY RULES:
- A false rotation is worse than a missed rotation. When uncertain, return 0.
- Use the orientation of the MAIN BODY TEXT only.
- Return a non-zero rotation only when the main text is clearly unreadable without rotating the document.
`;

    const retryDelays = [0, 2000, 5000, 10000];
    
    for (let i = 0; i < retryDelays.length; i++) {
      const attempt = i + 1;
      console.log(`[Gemini] Attempt ${attempt}`);

      if (retryDelays[i] > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
      }

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        });

        console.log("=== GEMINI VISION RESPONSE ===");
        const result = cleanAndParseGeminiResponse(response.text ?? "");
        return result;

      } catch (error: any) {
        const status = error?.status || error?.response?.status;
        const message = error?.message || "";
        
        if (attempt < retryDelays.length && (status === 503 || status === 429)) {
          console.log(`[Gemini] Temporary service error (${status}). Retrying...`);
          continue;
        }

        if (status === 429 || message.toLowerCase().includes("quota exceeded")) {
          console.error("Gemini Quota Exceeded (Vision):", message);
          throw new AIQuotaExceededError();
        }

        console.error("Gemini Vision AI Error:", error);
        throw error;
      }
    }

    throw new Error("AI Processing Failed");
  }
}
