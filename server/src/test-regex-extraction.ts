import { extractMetadata } from './services/metadata/metadataExtractor';

function runTests() {
  console.log('--- TEST: PAN Card ---');
  const panInput = 'PAN: ABCDE1234F';
  console.log(JSON.stringify(extractMetadata(panInput), null, 2));

  console.log('--- TEST: Aadhaar ---');
  const aadhaarInput = '1234 5678 9123';
  console.log(JSON.stringify(extractMetadata(aadhaarInput), null, 2));

  console.log('--- TEST: Bank Statement ---');
  const bankInput = 'Credit ₹25,000\nBalance ₹1,50,000';
  console.log(JSON.stringify(extractMetadata(bankInput), null, 2));

  console.log('--- TEST: Utility Bill ---');
  const utilityInput = 'support@company.com\n+91 9876543210\nhttps://company.com';
  console.log(JSON.stringify(extractMetadata(utilityInput), null, 2));
}

runTests();
