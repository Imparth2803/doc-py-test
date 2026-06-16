/**
 * Simple structured logger for document processing metrics and reliability.
 */
export const logMetric = (data: {
  documentId: string;
  stepName: string;
  durationMs: number;
  timestamp?: string;
  metadata?: Record<string, any>;
}) => {
  const logEntry = {
    level: 'info',
    message: `[METRIC] ${data.stepName}`,
    documentId: data.documentId,
    stepName: data.stepName,
    durationMs: data.durationMs,
    timestamp: data.timestamp || new Date().toISOString(),
    ...data.metadata,
  };
  console.log(JSON.stringify(logEntry));
};

export const logError = (data: {
  documentId?: string;
  jobId?: string;
  stage: string;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}) => {
  const logEntry = {
    level: 'error',
    message: `[ERROR] ${data.stage}: ${data.message}`,
    documentId: data.documentId,
    jobId: data.jobId,
    stage: data.stage,
    errorMessage: data.message,
    stack: data.stack,
    timestamp: new Date().toISOString(),
    ...data.metadata,
  };
  console.error(JSON.stringify(logEntry));
};

/**
 * Helper to measure execution time of a function.
 */
export const measureStep = async <T>(
  documentId: string,
  stepName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    logMetric({ documentId, stepName, durationMs, metadata });
    return result;
  } catch (error: any) {
    const durationMs = Date.now() - start;
    logMetric({ documentId, stepName: `${stepName}_FAILED`, durationMs, metadata });
    throw error;
  }
};
