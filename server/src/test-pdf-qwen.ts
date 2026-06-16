import { extractTextAndEvaluate } from "./services/ocrService";
import { analyzeWithLocalModel } from "./services/ai/localModelService";

async function main() {
  const ocr = await extractTextAndEvaluate(
    "./uploads/1780446521487-Air India Web Booking eTicket (82BL3M) - PARTH SATISH (1).pdf",
    "application/pdf"
  );

  console.log("Strategy:", ocr.strategy);
  console.log("Confidence:", ocr.confidence);
  console.log("Text Length:", ocr.extractedText.length);
  console.log(
    "First 500 chars:",
    ocr.extractedText.slice(0, 500)
  );

  console.log(
    "\nFIRST 1000 CHARS:\n",
    ocr.extractedText.slice(0, 1000)
  );

  const result = await analyzeWithLocalModel(
    ocr.extractedText,
    "Air India Ticket.pdf"
  );

  console.log(
    JSON.stringify(result, null, 2)
  );
}

main().catch(console.error);