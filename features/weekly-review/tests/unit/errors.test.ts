import { describe, it, expect } from 'vitest';
import { ConfigError, JiraApiError } from '@shared/errors.js';
import { ScopeTooLargeError, LlmAnalysisFailedError } from '../../src/errors.js';

describe('ConfigError', () => {
  it('extends Error', () => {
    const e = new ConfigError('bad config');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ConfigError);
  });

  it('sets name and message', () => {
    const e = new ConfigError('missing JIRA_BASE_URL');
    expect(e.name).toBe('ConfigError');
    expect(e.message).toBe('missing JIRA_BASE_URL');
  });
});

describe('ScopeTooLargeError', () => {
  it('extends Error', () => {
    const e = new ScopeTooLargeError(25, 20);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ScopeTooLargeError);
  });

  it('formats message with count and max', () => {
    const e = new ScopeTooLargeError(25, 20);
    expect(e.name).toBe('ScopeTooLargeError');
    expect(e.message).toBe('Filter returned 25 epics, exceeds maxEpicsPerRun of 20');
  });

  it('formats message at boundary (count = max + 1)', () => {
    const e = new ScopeTooLargeError(21, 20);
    expect(e.message).toContain('21');
    expect(e.message).toContain('20');
  });
});

describe('JiraApiError', () => {
  it('extends Error', () => {
    const e = new JiraApiError('not found', 404, '/rest/api/3/issue/CM-999');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(JiraApiError);
  });

  it('sets name, message, status, and path', () => {
    const e = new JiraApiError('rate limited', 429, '/rest/api/3/search/jql');
    expect(e.name).toBe('JiraApiError');
    expect(e.message).toBe('rate limited');
    expect(e.status).toBe(429);
    expect(e.path).toBe('/rest/api/3/search/jql');
  });

  it('can be constructed without status or path', () => {
    const e = new JiraApiError('network error');
    expect(e.status).toBeUndefined();
    expect(e.path).toBeUndefined();
  });

  it('catches 5xx as server errors', () => {
    const e = new JiraApiError('internal error', 500, '/rest/api/3/issue/CM-1/comment');
    expect(e.status).toBe(500);
  });
});

describe('LlmAnalysisFailedError', () => {
  it('extends Error', () => {
    const e = new LlmAnalysisFailedError('no tool call');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(LlmAnalysisFailedError);
  });

  it('sets name and message', () => {
    const e = new LlmAnalysisFailedError('model returned wrong epicKey');
    expect(e.name).toBe('LlmAnalysisFailedError');
    expect(e.message).toBe('model returned wrong epicKey');
  });
});
