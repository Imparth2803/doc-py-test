import axios from 'axios';
import { logMetric, logError } from '../utils/logger';
import { getOCRServiceUrl } from '../config/serviceUrls';

/**
 * Service to handle table extraction from documents using the FastAPI OCR service.
 */
export const extractTables = async (documentId: string, filePath: string, strategy: string): Promise<any[]> => {
  const ocrUrl = getOCRServiceUrl();
  const perfStart = Date.now();
  
  console.log(`[TABLE_EXTRACTION] Requesting table extraction for ${filePath} (Strategy: ${strategy})`);
  
  try {
    const response = await axios.post(
      `${ocrUrl}/extract-tables`,
      { file_path: filePath, strategy },
      { timeout: 180000 } // Increased timeout for multi-page scanned table recognition
    );
    
    const duration = Date.now() - perfStart;
    
    if (response.data.success) {
      logMetric({
        documentId,
        stepName: "TABLE_EXTRACTION",
        durationMs: duration,
        metadata: {
          tablesFound: response.data.tables.length,
          success: true
        }
      });
      return response.data.tables;
    } else {
      throw new Error(response.data.error || 'FastAPI returned failure');
    }
  } catch (error: any) {
    const duration = Date.now() - perfStart;
    console.error(`[TABLE_EXTRACTION] Error for ${documentId}:`, error.message);
    
    logError({
      documentId,
      stage: "TABLE_EXTRACTION",
      message: error.message,
      stack: error.stack,
      metadata: { durationMs: duration }
    });
    
    // Return empty array on failure - table extraction is non-blocking
    return [];
  }
};
