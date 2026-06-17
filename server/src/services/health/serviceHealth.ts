import { ServiceHealthStatus } from './types';
import { REGISTERED_SERVICES } from '../../config/serviceRegistry';

export const checkOCRHealth = async (): Promise<ServiceHealthStatus> => {
  return {
    service: 'ocr',
    status: 'unknown',
    lastChecked: new Date()
  };
};

export const checkGLiNERHealth = async (): Promise<ServiceHealthStatus> => {
  return {
    service: 'gliner',
    status: 'unknown',
    lastChecked: new Date()
  };
};

export const checkOllamaHealth = async (): Promise<ServiceHealthStatus> => {
  return {
    service: 'ollama',
    status: 'unknown',
    lastChecked: new Date()
  };
};

export const getSystemHealth = async (): Promise<ServiceHealthStatus[]> => {
  return [
    await checkOCRHealth(),
    await checkGLiNERHealth(),
    await checkOllamaHealth()
  ];
};
