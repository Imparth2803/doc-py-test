import axios from 'axios';
import { logMetric, logError } from '../utils/logger';
import { getTableServiceUrl } from '../config/serviceUrls';

/**
 * Validates that the Table service is reachable at startup.
 */
export const validateTableServiceHealth = async () => {
  const tableUrl = getTableServiceUrl();
  console.log(`[TABLES] Validating FastAPI Table Service health at ${tableUrl}...`);
  try {
    const response = await axios.get(`${tableUrl}/health`, { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('✅ Table Service is healthy');
    } else {
      console.warn('⚠️ Table Service returned unexpected health status:', response.data);
    }
  } catch (error: any) {
    console.error('❌ Table Service health check failed:', error.message);
    console.warn(`Make sure the FastAPI Table server is running on ${tableUrl}`);
  }
};

/**
 * Service to handle table extraction from documents using the FastAPI Table service.
 */
export const extractTables = async (documentId: string, filePath: string, strategy: string): Promise<any[]> => {
  const tableUrl = getTableServiceUrl();
  const perfStart = Date.now();
  
  console.log(`[TABLE_EXTRACTION] Requesting table extraction for ${filePath} (Strategy: ${strategy})`);
  
  try {
    const response = await axios.post(
      `${tableUrl}/extract-tables`,
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
          tablesFound: response.data.totalTables || response.data.tables?.length || 0,
          success: true
        }
      });
      return response.data;
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
    
    throw error;
  }
};
