import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });
import { aiOrchestrator } from '../services/ai/aiOrchestrator';

async function main() {
  console.log('=== AI ORCHESTRATOR FALLBACK VERIFICATION ===');
  console.log('PRIMARY_AI_PROVIDER:', process.env.PRIMARY_AI_PROVIDER || 'gemini');
  console.log('FALLBACK_AI_PROVIDER:', process.env.FALLBACK_AI_PROVIDER || 'local');

  try {
    const start = Date.now();
    const result = await aiOrchestrator.analyzeText(
      'INVOICE. Tata Power Bill. Due Date: 15-08-2026. Total Amount Due: Rs 2,500.',
      'TataPowerBill.pdf'
    );
    console.log('Orchestrator success! Latency:', Date.now() - start, 'ms');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Orchestrator failed (Expected because both Gemini and local are failing):');
    console.error(err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
