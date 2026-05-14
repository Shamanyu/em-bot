import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JiraClient } from '@shared/jira/client.js';

// Reset the module cache between tests so the module-level `cached` variable is cleared
async function freshDiscoverCustomFields() {
  vi.resetModules();
  const mod = await import('@shared/jira/customFields.js');
  return mod.discoverCustomFields;
}

function makeField(id: string, name: string) {
  return { id, name };
}

describe('discoverCustomFields', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('discovers story points field by name "story points"', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([
        makeField('customfield_10016', 'Story Points'),
        makeField('customfield_10014', 'Epic Link'),
      ]),
    } as unknown as JiraClient;

    const result = await discoverCustomFields(client);
    expect(result.storyPointsField).toBe('customfield_10016');
  });

  it('discovers story points field by name "story point estimate"', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([
        makeField('customfield_10016', 'Story Point Estimate'),
      ]),
    } as unknown as JiraClient;

    const result = await discoverCustomFields(client);
    expect(result.storyPointsField).toBe('customfield_10016');
  });

  it('discovers epic link field', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([
        makeField('customfield_10014', 'Epic Link'),
      ]),
    } as unknown as JiraClient;

    const result = await discoverCustomFields(client);
    expect(result.epicLinkField).toBe('customfield_10014');
  });

  it('is case-insensitive for field name matching', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([
        makeField('customfield_10016', 'STORY POINTS'),
        makeField('customfield_10014', 'EPIC LINK'),
      ]),
    } as unknown as JiraClient;

    const result = await discoverCustomFields(client);
    expect(result.storyPointsField).toBe('customfield_10016');
    expect(result.epicLinkField).toBe('customfield_10014');
  });

  it('returns null for both when no matching fields', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([
        makeField('customfield_10001', 'Priority'),
        makeField('customfield_10002', 'Labels'),
      ]),
    } as unknown as JiraClient;

    const result = await discoverCustomFields(client);
    expect(result.storyPointsField).toBeNull();
    expect(result.epicLinkField).toBeNull();
  });

  it('returns null when fields list is empty', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([]),
    } as unknown as JiraClient;

    const result = await discoverCustomFields(client);
    expect(result.storyPointsField).toBeNull();
    expect(result.epicLinkField).toBeNull();
  });

  it('uses first matching field when multiple have the same name', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([
        makeField('customfield_10016', 'Story Points'),
        makeField('customfield_99999', 'Story Points'),
      ]),
    } as unknown as JiraClient;

    const result = await discoverCustomFields(client);
    expect(result.storyPointsField).toBe('customfield_10016');
  });

  it('caches result and does not call client.get a second time', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([
        makeField('customfield_10016', 'Story Points'),
      ]),
    } as unknown as JiraClient;

    await discoverCustomFields(client);
    await discoverCustomFields(client);

    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it('calls GET /rest/api/3/field', async () => {
    const discoverCustomFields = await freshDiscoverCustomFields();
    const client = {
      get: vi.fn().mockResolvedValue([]),
    } as unknown as JiraClient;

    await discoverCustomFields(client);
    expect(client.get).toHaveBeenCalledWith('/rest/api/3/field');
  });
});
