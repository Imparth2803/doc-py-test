import axios from 'axios';
import { getGLiNERUrl } from '../../config/serviceUrls';
import { GLiNEREntities, GLiNERResult } from './types';

export const validateGLiNERServiceHealth = async () => {
  const glinerUrl = getGLiNERUrl();
  console.log(`[GLiNER] Validating service health at ${glinerUrl}...`);
  try {
    const response = await axios.get(`${glinerUrl}/health`, { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('[GLiNER] Service healthy');
    } else {
      console.warn('[GLiNER] Service returned unexpected health status:', response.data);
    }
  } catch (error: any) {
    console.error('[GLiNER] Service unavailable:', error.message);
  }
};

export const extractEntitiesWithGLiNER = async (text: string): Promise<GLiNERResult> => {
  const defaultEntities: GLiNEREntities = {
    persons: [],
    organizations: [],
    locations: []
  };

  if (!text || text.trim().length === 0) {
    return { entities: defaultEntities, rawEntities: [], chunkCount: 0, avgConfidence: 0, latencyMs: 0 };
  }

  const startTime = Date.now();
  try {
    const url = getGLiNERUrl();
    const response = await axios.post(
      `${url}/extract-entities`,
      { text },
      { timeout: 30000 } // Increased timeout for chunking
    );

    const latencyMs = Date.now() - startTime;
    const data = response.data;
    
    let avgConfidence = 0;
    if (data.raw_entities && data.raw_entities.length > 0) {
      const sum = data.raw_entities.reduce((acc: number, curr: any) => acc + curr.confidence, 0);
      avgConfidence = sum / data.raw_entities.length;
    }

    return {
      entities: {
        persons: data.persons || [],
        organizations: data.organizations || [],
        locations: data.locations || []
      },
      rawEntities: data.raw_entities || [],
      chunkCount: data.chunk_count || 1,
      avgConfidence,
      latencyMs
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('[GLiNER] Extraction failed, returning empty entities (Shadow Mode). Error:', error.message);
    return {
      entities: defaultEntities,
      rawEntities: [],
      chunkCount: 0,
      avgConfidence: 0,
      latencyMs
    };
  }
};
