export class ScopeTooLargeError extends Error {
  constructor(count: number, max: number) {
    super(`Filter returned ${count} epics, exceeds maxEpicsPerRun of ${max}`);
    this.name = 'ScopeTooLargeError';
  }
}

export class LlmAnalysisFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmAnalysisFailedError';
  }
}
