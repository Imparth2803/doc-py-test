import { OCRSanitizationDiagnostics } from './ocrSanitizer';

export const printOCRQualityBenchmark = (diagnostics: OCRSanitizationDiagnostics) => {
  console.log('=================================');
  console.log('OCR Quality Benchmark');
  console.log('=================================');
  console.log(`Original Length: ${diagnostics.originalLength}`);
  console.log(`Cleaned Length: ${diagnostics.cleanedLength}`);
  console.log(`Garbage Removed: ${diagnostics.removedGarbageLines}`);
  console.log(`Whitespace Fixed: ${diagnostics.collapsedWhitespace}`);
  console.log('=================================\n');
};
