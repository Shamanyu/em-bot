export class ConfigError extends Error {
  name = 'ConfigError';
  constructor(message: string) {
    super(message);
  }
}

export class ScopeTooLargeError extends Error {
  name = 'ScopeTooLargeError';
  constructor(count: number, max: number) {
    super(`Filter returned ${count} epics, exceeds maxEpicsPerRun of ${max}`);
  }
}

export class JiraApiError extends Error {
  name = 'JiraApiError';
  constructor(
    message: string,
    public status?: number,
    public path?: string,
  ) {
    super(message);
  }
}

export class LlmAnalysisFailedError extends Error {
  name = 'LlmAnalysisFailedError';
  constructor(message: string) {
    super(message);
  }
}
