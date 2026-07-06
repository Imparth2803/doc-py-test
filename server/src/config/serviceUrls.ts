import { SERVICES } from './services';

export const getBackendUrl = () => `http://${SERVICES.backend.host}:${SERVICES.backend.port}`;
export const getOCRServiceUrl = () => `http://${SERVICES.ocr.host}:${SERVICES.ocr.port}`;
export const getTableServiceUrl = () => `http://${SERVICES.table_extraction.host}:${SERVICES.table_extraction.port}`;
export const getGLiNERUrl = () => `http://${SERVICES.gliner.host}:${SERVICES.gliner.port}`;
export const getOllamaUrl = () => `http://${SERVICES.ollama.host}:${SERVICES.ollama.port}`;
