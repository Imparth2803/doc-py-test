import { getBackendUrl, getOCRServiceUrl, getTableServiceUrl, getGLiNERUrl, getOllamaUrl } from './serviceUrls';

export const REGISTERED_SERVICES = {
  backend: getBackendUrl(),
  ocr: getOCRServiceUrl(),
  table_extraction: getTableServiceUrl(),
  gliner: getGLiNERUrl(),
  ollama: getOllamaUrl()
};
