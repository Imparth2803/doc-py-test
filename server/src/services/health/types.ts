export interface ServiceHealthStatus {
  service: string;
  status: 'ok' | 'error' | 'unknown';
  latencyMs?: number;
  lastChecked?: Date;
  details?: Record<string, any>;
}
