import { aiOrchestrator } from './services/ai/aiOrchestrator';

async function run() {
  const dummyInvoice = `
INVOICE
-------
Invoice Number: INV-2023-001
Date: 2023-10-15
Due Date: 2023-11-15
To: John Doe, 123 Main St, Springfield

Items:
- Web Design Services: $1,500.00
- Hosting Setup: $200.00

Total Amount: $1,700.00
Payment Status: Unpaid
  `;

  const base64Data = Buffer.from(dummyInvoice).toString('base64');
  const mimeType = 'text/plain';
  const fileName = 'invoice.txt';

  try {
    const result = await aiOrchestrator.analyzeDocument(base64Data, mimeType, fileName);
    console.log("FINAL RESULT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
