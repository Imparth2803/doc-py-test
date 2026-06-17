import axios from 'axios';
import { getGLiNERUrl } from '../../config/serviceUrls';
import { GLiNEREntities, GLiNERResult } from './types';

export const extractEntitiesWithGLiNER = async (text: string): Promise<GLiNERResult> => {
  const defaultEntities: GLiNEREntities = {
    persons: [],
    organizations: [],
    locations: []
  };

  if (!text || text.trim().length === 0) {
    return { entities: defaultEntities, latencyMs: 0 };
  }

  const startTime = Date.now();
  try {
    const url = getGLiNERUrl();
    const response = await axios.post(
      `${url}/extract-entities`,
      { text },
      { timeout: 15000 } // 15 sec timeout
    );

    const latencyMs = Date.now() - startTime;
    return {
      entities: response.data,
      latencyMs
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('[GLiNER] Extraction failed, returning empty entities (Shadow Mode). Error:', error.message);
    return {
      entities: defaultEntities,
      latencyMs
    };
  }
};
