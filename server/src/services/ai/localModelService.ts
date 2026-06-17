import axios from 'axios';
import { getOllamaUrl } from '../../config/serviceUrls';

export interface AIAnalysisResult {
  tags: string[];
  entities: string[];
  category: string;
  summary: string;
  suggestedFilename: string;
}

export const analyzeWithLocalModel = async (
  text: string,
  fileName: string
): Promise<AIAnalysisResult> => {
  try {
    // Prevent huge PDFs from overwhelming Qwen
    const truncatedText = text.slice(0, 12000);

    const prompt = `
Analyze this document.

Filename:
${fileName}

Extract ONLY PRIMARY STAKEHOLDERS.

A stakeholder is:
- Document owner
- Document holder
- Issuing organization
- Bank
- University
- Employer
- Government authority
- Company legally responsible for the document

Prefer owner and issuer.

Do NOT include:
- Locations
- Dates
- Years
- Amounts
- IDs
- Account numbers
- Ticket numbers
- References
- Products
- Services
- Technical terms

Entities must be an array of strings.

Category must be ONE of:

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

Generate a human readable filename.

Rules:
- Maximum 60 characters
- No extension
- Include document type
- Include owner name when useful
- Do not include IDs
- Do not include locations
- Do not include dates unless important

Return ONLY valid JSON.

{
  "summary":"",
  "category":"",
  "tags":[],
  "entities":[],
  "suggestedFilename":""
}

Document Text:

${truncatedText}
`;

    const response = await axios.post(
      `${getOllamaUrl()}/api/generate`,
      {
        model: 'qwen2.5:3b',
        prompt,
        stream: false,
        options: {
          temperature: 0,
          num_predict: 300
        }
      },
      {
        timeout: 60000
      }
    );

    const raw = response.data.response;

    const cleaned = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsed: any;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Invalid JSON from local model');
    }

    // Normalize entities if model returns objects
    if (
      Array.isArray(parsed.entities) &&
      parsed.entities.length > 0 &&
      typeof parsed.entities[0] === 'object'
    ) {
      parsed.entities = parsed.entities.map(
        (e: any) => e.name || String(e)
      );
    }

    // Safety defaults
    parsed.summary = parsed.summary || '';

    parsed.category = parsed.category || 'Other';

    parsed.tags = Array.isArray(parsed.tags)
      ? parsed.tags
      : [];

    parsed.entities = Array.isArray(parsed.entities)
      ? parsed.entities
      : [];

    parsed.suggestedFilename =
      parsed.suggestedFilename ||
      fileName.replace(/\.[^/.]+$/, '');

    // Limit filename length
    parsed.suggestedFilename =
      parsed.suggestedFilename
        .trim()
        .slice(0, 60);

    // Final validation
    if (
      !parsed.category ||
      !parsed.suggestedFilename
    ) {
      throw new Error(
        'Incomplete local model response'
      );
    }

    return {
      summary: parsed.summary,
      category: parsed.category,
      tags: parsed.tags,
      entities: parsed.entities,
      suggestedFilename:
        parsed.suggestedFilename
    };
  } catch (error) {
    console.error(
      'Local model error:',
      error
    );

    throw error;
  }
};