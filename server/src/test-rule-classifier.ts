import { classifyDocumentByRules } from './services/classification/ruleClassifier';
import { compareClassifications, printClassificationBenchmark } from './services/classification/classificationComparator';
import { ExtractedMetadata } from './services/metadata/types';
import { DocumentCategory } from './services/classification/classificationTypes';

const runTests = () => {
  const emptyMetadata: ExtractedMetadata = {
    dates: [], amounts: [], emails: [], phoneNumbers: [], ids: [], urls: []
  };

  console.log('--- TEST: PAN Card ---');
  const panMeta = { ...emptyMetadata, ids: ['ABCDE1234F'] };
  const panResult = classifyDocumentByRules('Permanent Account Number INCOME TAX DEPARTMENT signature', panMeta);
  console.log(panResult);
  printClassificationBenchmark(compareClassifications(panResult, 'PAN Card'));

  console.log('--- TEST: Aadhaar ---');
  const aadhaarMeta = { ...emptyMetadata, ids: ['1234 5678 9123'] };
  const aadhaarResult = classifyDocumentByRules('Government of India Unique Identification Authority of India UIDAI', aadhaarMeta);
  console.log(aadhaarResult);
  printClassificationBenchmark(compareClassifications(aadhaarResult, 'Aadhaar'));

  console.log('--- TEST: Invoice ---');
  const invoiceMeta = { ...emptyMetadata, amounts: ['100'] };
  const invoiceResult = classifyDocumentByRules('TAX INVOICE Invoice Number: 123 Total Amount: 100', invoiceMeta);
  console.log(invoiceResult);
  printClassificationBenchmark(compareClassifications(invoiceResult, 'Invoice'));
  
  console.log('--- TEST: Unknown / Fallback ---');
  const unknownResult = classifyDocumentByRules('Just some random text without any keywords', emptyMetadata);
  console.log(unknownResult);
  printClassificationBenchmark(compareClassifications(unknownResult, 'Other'));
};

runTests();
