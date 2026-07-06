import { sanitizeEntities } from './entitySanitizer';

const testData = [
  { text: "John Smith", label: "person", confidence: 0.95 },
  { text: "State Bank Of India", label: "organization", confidence: 0.88 },
  { text: "123456789", label: "misc", confidence: 0.99 },
  { text: "INV-2025-001", label: "misc", confidence: 0.85 },
  { text: "ABCDE1234F", label: "misc", confidence: 0.90 },
  { text: "01/01/2025", label: "misc", confidence: 0.92 },
  { text: "Jane Doe", label: "person", confidence: 0.60 }, // Low confidence
  { text: "TCS", label: "organization", confidence: 0.72 },
  { text: "tcs", label: "organization", confidence: 0.80 }, // Dup test
  { text: "₹25000", label: "misc", confidence: 0.95 },
];

const result = sanitizeEntities(testData);

console.log("Output:");
console.log(JSON.stringify(result.entities, null, 2));

console.log("\nDiagnostics:");
console.log(JSON.stringify(result.diagnostics, null, 2));
