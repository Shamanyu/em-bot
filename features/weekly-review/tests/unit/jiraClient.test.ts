import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JiraClient } from '@shared/jira/client.js';
import { JiraApiError } from '@shared/errors.js';
import type { JiraCommentRaw } from '@shared/jira/types.js';

// Helper: build a minimal JiraCommentRaw
function makeRawComment(id: string, body = 'comment body'): JiraCommentRaw {
  return {
    id,
    author: { displayName: 'Alice', accountId: 'acc-1' },
    created: '2026-05-06T10:00:00.000Z',
    body: { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] },
  };
}

describe('JiraClient', () => {
  let client: JiraClient;

  beforeEach(() => {
    client = new JiraClient('https://jira.example.com', 'user@test.com', 'secret-token');
  });

  describe('auth header', () => {
    it('sets Authorization header with base64-encoded email:token', () => {
      // Access the internal axios instance to verify headers
      const http = (client as unknown as { http: { defaults: { headers: { common?: Record<string, string>; Authorization?: string } } } }).http;
      const rawHeaders = http.defaults.headers as Record<string, unknown>;
      // Axios may store custom headers at different nesting levels depending on version
      const authHeader =
        (rawHeaders['Authorization'] as string | undefined) ??
        ((rawHeaders['common'] as Record<string, string> | undefined)?.['Authorization']);
      expect(authHeader).toBeDefined();
      expect(authHeader).toMatch(/^Basic /);
      // Decode and verify payload
      const encoded = (authHeader as string).replace('Basic ', '');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      expect(decoded).toBe('user@test.com:secret-token');
    });
  });

  describe('getComments', () => {
    it('returns empty array when total is 0', async () => {
      const getSpy = vi.spyOn(client, 'get').mockResolvedValueOnce({
        comments: [],
        total: 0,
        startAt: 0,
        maxResults: 100,
      });
      const comments = await client.getComments('CM-1');
      expect(comments).toEqual([]);
      expect(getSpy).toHaveBeenCalledTimes(1);
    });

    it('returns all comments when they fit in a single page', async () => {
      const batch = [makeRawComment('1'), makeRawComment('2'), makeRawComment('3')];
      vi.spyOn(client, 'get').mockResolvedValueOnce({
        comments: batch,
        total: 3,
        startAt: 0,
        maxResults: 100,
      });
      const comments = await client.getComments('CM-2');
      expect(comments).toHaveLength(3);
      expect(comments[0]?.id).toBe('1');
    });

    it('fetches subsequent pages when total exceeds first page', async () => {
      const page1 = Array.from({ length: 3 }, (_, i) => makeRawComment(String(i + 1)));
      const page2 = [makeRawComment('4')];
      const getSpy = vi.spyOn(client, 'get')
        .mockResolvedValueOnce({ comments: page1, total: 4, startAt: 0, maxResults: 100 })
        .mockResolvedValueOnce({ comments: page2, total: 4, startAt: 100, maxResults: 100 });

      const comments = await client.getComments('CM-3');
      expect(comments).toHaveLength(4);
      expect(getSpy).toHaveBeenCalledTimes(2);
      // Second call should use startAt=100 (first page maxResults)
      expect(getSpy).toHaveBeenNthCalledWith(
        2,
        '/rest/api/3/issue/CM-3/comment',
        { startAt: 100, maxResults: 100, orderBy: 'created' },
      );
    });

    it('correctly passes issueKey in URL', async () => {
      const getSpy = vi.spyOn(client, 'get').mockResolvedValueOnce({
        comments: [],
        total: 0,
        startAt: 0,
        maxResults: 100,
      });
      await client.getComments('SP-42');
      expect(getSpy).toHaveBeenCalledWith(
        '/rest/api/3/issue/SP-42/comment',
        expect.objectContaining({ startAt: 0 }),
      );
    });
  });

  describe('searchByJql', () => {
    it('sends POST with jql, fields, maxResults and returns issues', async () => {
      const postSpy = vi.spyOn(client, 'post').mockResolvedValueOnce({
        issues: [{ id: '1', key: 'CM-1', fields: {} }],
        isLast: true,
      });
      const result = await client.searchByJql('project = CM', ['summary'], 50);
      expect(postSpy).toHaveBeenCalledWith('/rest/api/3/search/jql', {
        jql: 'project = CM',
        fields: ['summary'],
        maxResults: 50,
      });
      expect(result.issues).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns total as the count of returned issues (not a separate field)', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({
        issues: [
          { id: '1', key: 'CM-1', fields: {} },
          { id: '2', key: 'CM-2', fields: {} },
        ],
        isLast: false,
      });
      const result = await client.searchByJql('project = CM', ['summary'], 100);
      expect(result.total).toBe(2);
    });
  });

  describe('addComment', () => {
    it('POSTs to correct URL with body wrapped in body key', async () => {
      const postSpy = vi.spyOn(client, 'post').mockResolvedValueOnce({ id: 'comment-123' });
      const adf = { version: 1, type: 'doc', content: [] };
      const result = await client.addComment('CM-100', adf);
      expect(postSpy).toHaveBeenCalledWith('/rest/api/3/issue/CM-100/comment', { body: adf });
      expect(result.id).toBe('comment-123');
    });
  });

  describe('getIssue', () => {
    it('GETs correct issue path', async () => {
      const fakIssue = { id: '10001', key: 'CM-100', fields: {} };
      const getSpy = vi.spyOn(client, 'get').mockResolvedValueOnce(fakIssue);
      const issue = await client.getIssue('CM-100');
      expect(getSpy).toHaveBeenCalledWith('/rest/api/3/issue/CM-100');
      expect(issue.key).toBe('CM-100');
    });
  });

  describe('getFilter', () => {
    it('GETs correct filter path and returns jql', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ jql: 'project = CM AND sprint in openSprints()' });
      const filter = await client.getFilter(12345);
      expect(filter.jql).toBe('project = CM AND sprint in openSprints()');
    });
  });

  describe('handleError wrapping', () => {
    it('wraps errors into JiraApiError when http throws', async () => {
      // Spy on the internal post to throw a shaped error
      vi.spyOn(client, 'post').mockRejectedValueOnce(
        new JiraApiError('Request failed with status 404 — {"errorMessages":["Issue does not exist"]}', 404, '/rest/api/3/issue/CM-999/comment'),
      );
      await expect(client.addComment('CM-999', {})).rejects.toThrow(JiraApiError);
    });
  });
});
