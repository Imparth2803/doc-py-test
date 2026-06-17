export const SERVICES = {
  frontend: {
    host: process.env.FRONTEND_HOST || 'localhost',
    port: Number(process.env.FRONTEND_PORT || 3000)
  },
  backend: {
    host: process.env.BACKEND_HOST || 'localhost',
    port: Number(process.env.BACKEND_PORT || 8000)
  },
  ocr: {
    host: process.env.OCR_SERVICE_HOST || 'localhost',
    port: Number(process.env.OCR_SERVICE_PORT || 8001)
  },
  gliner: {
    host: process.env.GLINER_HOST || 'localhost',
    port: Number(process.env.GLINER_PORT || 8002)
  },
  ollama: {
    host: process.env.OLLAMA_HOST || 'localhost',
    port: Number(process.env.OLLAMA_PORT || 11434)
  }
};
