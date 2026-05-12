import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { withExponentialBackoff } from '../lib/retry.js';
import { JiraApiError } from '../errors.js';
import type { JiraIssueRaw, JiraCommentRaw } from '../types/EpicSnapshot.js';

const THROTTLE_MS = 250;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(err: unknown): boolean {
  // JiraApiError (already wrapped)
  const jiraStatus = (err as { status?: number })?.status;
  if (typeof jiraStatus === 'number') {
    return jiraStatus === 429 || jiraStatus >= 500;
  }
  // Raw AxiosError (before wrapping)
  const axiosStatus = (err as AxiosError)?.response?.status;
  return axiosStatus === 429 || (typeof axiosStatus === 'number' && axiosStatus >= 500);
}

export class JiraClient {
  private http: AxiosInstance;
  private lastRequestAt = 0;

  constructor(
    baseUrl: string,
    email: string,
    token: string,
  ) {
    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < THROTTLE_MS) {
      await sleep(THROTTLE_MS - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    await this.throttle();
    return withExponentialBackoff(
      async () => {
        try {
          const res = await this.http.get<T>(path, { params });
          return res.data;
        } catch (err) {
          this.handleError(err, path);
        }
      },
      { retries: 3, initialDelayMs: 1000, shouldRetry: isRetryable },
    );
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return withExponentialBackoff(
      async () => {
        try {
          const res = await this.http.post<T>(path, body);
          return res.data;
        } catch (err) {
          this.handleError(err, path);
        }
      },
      { retries: 1, initialDelayMs: 1000, shouldRetry: isRetryable },
    );
  }

  private handleError(err: unknown, path: string): never {
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status;
    const body = axiosErr.response?.data;
    const message = `${axiosErr.message ?? 'JIRA API error'} — ${JSON.stringify(body)}`;
    throw new JiraApiError(message, status, path);
  }

  async getFilter(filterId: number): Promise<{ jql: string }> {
    return this.get<{ jql: string }>(`/rest/api/3/filter/${filterId}`);
  }

  async searchByJql(
    jql: string,
    fields: string[],
    maxResults = 100,
  ): Promise<{ issues: JiraIssueRaw[]; total: number }> {
    // POST /rest/api/3/search/jql uses cursor-based pagination — no startAt
    const res = await this.post<{ issues: JiraIssueRaw[]; isLast: boolean }>('/rest/api/3/search/jql', {
      jql,
      fields,
      maxResults,
    });
    return { issues: res.issues, total: res.issues.length };
  }

  async getIssue(issueKey: string): Promise<JiraIssueRaw> {
    return this.get<JiraIssueRaw>(`/rest/api/3/issue/${issueKey}`);
  }

  async getComments(issueKey: string): Promise<JiraCommentRaw[]> {
    const allComments: JiraCommentRaw[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const res = await this.get<{
        comments: JiraCommentRaw[];
        total: number;
        startAt: number;
        maxResults: number;
      }>(`/rest/api/3/issue/${issueKey}/comment`, { startAt, maxResults, orderBy: 'created' });

      allComments.push(...res.comments);
      if (allComments.length >= res.total) break;
      startAt += maxResults;
    }

    return allComments;
  }

  async addComment(issueKey: string, body: unknown): Promise<{ id: string }> {
    return this.post<{ id: string }>(`/rest/api/3/issue/${issueKey}/comment`, { body });
  }

  async getChildIssuesViaAgile(epicKey: string): Promise<JiraIssueRaw[]> {
    try {
      const res = await this.get<{ issues: JiraIssueRaw[] }>(
        `/rest/agile/1.0/board`,
        {},
      );
      // Fallback: search by parent link
      const searchRes = await this.searchByJql(
        `"Epic Link" = ${epicKey} ORDER BY created ASC`,
        ['summary', 'status', 'assignee', 'issuetype', 'created', 'updated', 'duedate', 'description', 'parent'],
        100,
      );
      void res;
      return searchRes.issues;
    } catch {
      return [];
    }
  }
}
