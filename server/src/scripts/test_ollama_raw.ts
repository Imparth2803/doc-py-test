import axios from "axios";

const OLLAMA_URL = "http://localhost:11434";
const LOCAL_ANALYSIS_MODEL = "qwen2.5:3b";

async function runTest(testName: string, promptText: string) {
  console.log(`\n--- Test: ${testName} ---`);
  try {
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: LOCAL_ANALYSIS_MODEL,
        prompt: promptText,
        stream: false,
        format: "json",
        options: { temperature: 0.1 }
      }
    );
    console.log("RAW RESPONSE:");
    console.log(JSON.stringify(response.data.response));
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

const basePrompt = `System:
You are a document analysis engine.
Return valid JSON only.

JSON Format:
{
  "summary": "2-4 concise sentences summarizing the document.",
  "tags": ["3 to 10 lowercase, search-oriented tags"],
  "suggestedFilename": "Human-readable filename max 80 chars"
}

User:
`;

async function main() {
  await runTest("Invoice", basePrompt + "Category: INVOICE\nEntities: Tata Motors\nDates: 2025-01-01\nAmounts: 500\nDocument Text: INVOICE\nTata Motors\n1 Jan 2025\nTotal: 500");
  await runTest("Bank Statement", basePrompt + "Category: BANK_STATEMENT\nEntities: HDFC Bank, John Doe\nDates: 2025-01-01 to 2025-01-31\nAmounts: 1000, 5000\nDocument Text: Bank Statement\nHDFC Bank\nJohn Doe\nPeriod: Jan 2025");
  await runTest("Empty Document", basePrompt + "Category: Unknown\nDocument Text: ");
  await runTest("Long Text", basePrompt + "Category: CONTRACT\nDocument Text: " + "This is a contract. ".repeat(100));
  await runTest("Noise", basePrompt + "Category: Unknown\nDocument Text: @#$@#$@#$ 123123");
}

main();