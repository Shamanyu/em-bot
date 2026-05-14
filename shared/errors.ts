export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class JiraApiError extends Error {
  status?: number;
  path?: string;

  constructor(message: string, status?: number, path?: string) {
    super(message);
    this.name = 'JiraApiError';
    this.status = status;
    this.path = path;
  }
}
