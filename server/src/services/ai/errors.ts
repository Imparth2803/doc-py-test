// server/src/services/ai/errors.ts

export class AIQuotaExceededError extends Error {
  public errorCode = 'AI_QUOTA_EXCEEDED';
  public status = 429;

  constructor(message: string = 'AI processing quota exceeded. Please try again later.') {
    super(message);
    this.name = 'AIQuotaExceededError';
    Object.setPrototypeOf(this, AIQuotaExceededError.prototype);
  }
}
