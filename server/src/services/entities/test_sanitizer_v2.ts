import { sanitizeEntities } from './entitySanitizer';

const testData = [
  { text: "TCS", label: "organization", confidence: 0.95 },
  { text: "tcs", label: "organization", confidence: 0.80 },
  { text: "Tcs", label: "organization", confidence: 0.85 },
  { text: "State Bank of India", label: "organization", confidence: 0.90 },
  { text: "IBM", label: "organization", confidence: 0.95 },
  { text: "Qwerty", label: "organization", confidence: 0.90 },
  { text: "Statement", label: "organization", confidence: 0.80 },
  { text: "Account", label: "organization", confidence: 0.85 },
  { text: "John Smith", label: "person", confidence: 0.95 },
  { text: "Customer", label: "person", confidence: 0.85 },
  { text: "Account Holder", label: "person", confidence: 0.90 }
];

const result = sanitizeEntities(testData);
console.log("Output:");
console.log(JSON.stringify(result.entities, null, 2));

console.log("\nDiagnostics:");
console.log(JSON.stringify(result.diagnostics, null, 2));
