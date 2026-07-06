import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';

import { getOCRServiceUrl } from '../config/serviceUrls';

const runPaddleOCR = async (
  filePath: string,
  language: string
): Promise<{
  text: string;
  confidence: number;
  angle: number;
  orientationConfidence: number;
}> => {
  const ocrUrl = getOCRServiceUrl();
  console.log(`[OCR] Sending HTTP request to FastAPI OCR service at ${ocrUrl} for ${filePath}`);
  
  try {
    const response = await axios.post(
      `${ocrUrl}/ocr`,
      { file_path: filePath, language },
      { timeout: 120000 } // Hardened timeout: 120 seconds
    );
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (error: any) {
    console.error('[OCR] FastAPI Service error:', error.message);
    throw new Error(error.response?.data?.error || error.message || 'OCR request failed');
  }
};

/**
 * Validates that the OCR service is reachable at startup.
 */
export const validateOCRServiceHealth = async () => {
  const ocrUrl = getOCRServiceUrl();
  console.log(`[OCR] Validating FastAPI OCR Service health at ${ocrUrl}...`);
  try {
    const response = await axios.get(`${ocrUrl}/health`, { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('✅ OCR Service is healthy');
    } else {
      console.warn('⚠️ OCR Service returned unexpected health status:', response.data);
    }
  } catch (error: any) {
    console.error('❌ OCR Service health check failed:', error.message);
    console.warn(`Make sure the FastAPI OCR server is running on ${ocrUrl}`);
  }
};

import { extractPdfText } from './pdf/pdfTextExtractor';

export const extractTextAndEvaluate = async (filePath: string, mimeType: string, language: string = 'en') => {
  const perfStart = Date.now();
  console.log('[PERF] OCR Start');
  let extractedText = "";
  let confidence = 0;
  let angle = 0;
  let orientationConfidence = 0;
  let pageCount = 1; // Default for images
  let strategy: 'DIGITAL_DOCUMENT' | 'SCANNED_DOCUMENT' = 'SCANNED_DOCUMENT';
  let pdfExtractionDiag: any = undefined;

  try {
    if (mimeType === 'application/pdf') {
      const pdfResult = await extractPdfText(filePath);
      pageCount = pdfResult.pageCount || 1;
      
      pdfExtractionDiag = {
        engine: "PyMuPDF",
        success: pdfResult.success,
        pageCount: pdfResult.pageCount,
        textLength: pdfResult.text.length,
        ...(pdfResult.error ? { error: pdfResult.error } : {})
      };

      if (pdfResult.success && pdfResult.text.length > 50) {
        extractedText = pdfResult.text.trim();
        confidence = 100;
        angle = 0;
        orientationConfidence = 1.0;
        strategy = 'DIGITAL_DOCUMENT';
      } else {
        extractedText = pdfResult.text.trim();
        confidence = 0;
        strategy = 'SCANNED_DOCUMENT';
        
        if (!pdfResult.success) {
          console.error(`[PDF EXTRACTION FAILED] Document: ${path.basename(filePath)} Reason: ${pdfResult.error || 'Unknown error'} Fallback: OCR`);
        }
      }
    } 
    else if (mimeType.startsWith('image/')) {
      let ocrFilePath = filePath;
      let tempFilePath: string | null = null;
      pageCount = 1;

      try {
        const metadata = await sharp(filePath).metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;

        if (width > 1800 || height > 1800) {
          console.log(`[PERF] Resizing image for OCR. Original: ${width}x${height}`);
          tempFilePath = `${filePath}.ocr.tmp.jpg`;
          await sharp(filePath)
            .resize({
              width: 1800,
              height: 1800,
              fit: 'inside',
              withoutEnlargement: true
            })
            .toFile(tempFilePath);
          ocrFilePath = tempFilePath;
        }

        const result = await runPaddleOCR(
          ocrFilePath,
          language
        );

        extractedText =
          result.text.trim();

        confidence =
          result.confidence;

        angle =
          result.angle || 0;

        orientationConfidence =
          result.orientationConfidence || 0;

        console.log(`[OCR] angle=${angle} orientationConfidence=${orientationConfidence}`);

        if (
          confidence > 80 &&
          extractedText.length > 30
        ) {
          strategy = 'DIGITAL_DOCUMENT';
        } else {
          strategy = 'SCANNED_DOCUMENT';
        }
      } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`[PERF] Cleaned up temporary OCR file`);
        }
      }
    }

    console.log("================ [OCR TELEMETRY START] ================");
    console.log(`[OCR SUCCESS] File: ${path.basename(filePath)} | Length: ${extractedText ? extractedText.length : 0} characters`);
    console.log(`[OCR TEXT RAW PREVIEW]:\n${extractedText ? extractedText.substring(0, 500) : "--- EMPTY TEXT PAYLOAD ---"}`);
    console.log("================ [OCR TELEMETRY END] ================");

    const duration = Date.now() - perfStart;
    console.log(`[PERF] OCR End - ${duration}ms`);
    return { extractedText, confidence, strategy, angle, orientationConfidence, pageCount, pdfExtraction: pdfExtractionDiag };
  } catch (error: any) {
    const duration = Date.now() - perfStart;
    console.log(`[PERF] OCR End (Error) - ${duration}ms`);
    console.error("OCR Pipeline Error:", error);
    return { 
      extractedText: "", 
      confidence: 0, 
      strategy: 'SCANNED_DOCUMENT' as const, 
      angle: 0, 
      orientationConfidence: 0, 
      pageCount: 1,
      pdfExtraction: {
        engine: "PyMuPDF",
        success: false,
        error: error.message || String(error)
      }
    };
  }
};
