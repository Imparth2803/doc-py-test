import { getBackendUrl, getOCRServiceUrl, getGLiNERUrl, getOllamaUrl } from './serviceUrls';

export const REGISTERED_SERVICES = {
  backend: getBackendUrl(),
  ocr: getOCRServiceUrl(),
  gliner: getGLiNERUrl(),
  ollama: getOllamaUrl()
};
