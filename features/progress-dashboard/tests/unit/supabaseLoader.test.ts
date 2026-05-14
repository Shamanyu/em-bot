import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js before importing the module under test
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { loadConfigFromSupabase } from '../../src/config/supabaseLoader.js';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  process.env['SUPABASE_URL'] = 'https://test.supabase.co';
  process.env['SUPABASE_SERVICE_KEY'] = 'service-key';

  mockSingle.mockResolvedValue({
    data: {
      jira_base_url: 'https://acme.atlassian.net',
      jira_user_email: 'em@acme.com',
      jira_api_token_secret: 'vault-uuid-jira',
      anthropic_key_secret: 'vault-uuid-anthropic',
      project_keys: ['CM', 'XPS'],
      active_epics_max: 30,
      completed_lookback_days: 30,
      comment_lookback_days: 7,
      page_title: 'Acme Engineering',
      schedule_days: [1, 2, 3, 4, 5],
      schedule_time_utc: '10:30',
    },
    error: null,
  });

  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });

  // Vault decryption — second and third calls return secret values
  let vaultCallCount = 0;
  const vaultSingle = vi.fn().mockImplementation(() => {
    vaultCallCount++;
    return Promise.resolve({
      data: { decrypted_secret: vaultCallCount === 1 ? 'jira-token-value' : 'anthropic-key-value' },
      error: null,
    });
  });
  const vaultEq = vi.fn().mockReturnValue({ single: vaultSingle });
  const vaultSelect = vi.fn().mockReturnValue({ eq: vaultEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'vault.decrypted_secrets') {
      return { select: vaultSelect };
    }
    return { select: mockSelect };
  });

  vi.mocked(createClient).mockReturnValue({
    from: mockFrom,
    rpc: mockRpc,
  } as unknown as ReturnType<typeof createClient>);
});

describe('loadConfigFromSupabase', () => {
  it('returns config and env with decrypted credentials', async () => {
    const { config, env } = await loadConfigFromSupabase('tenant-123');

    expect(config.jira.projectKeys).toEqual(['CM', 'XPS']);
    expect(config.jira.activeEpicsMax).toBe(30);
    expect(config.schedule.completedLookbackDays).toBe(30);
    expect(config.schedule.commentLookbackDays).toBe(7);
    expect(config.output.pageTitle).toBe('Acme Engineering');

    expect(env.jiraBaseUrl).toBe('https://acme.atlassian.net');
    expect(env.jiraUserEmail).toBe('em@acme.com');
    expect(env.jiraApiToken).toBe('jira-token-value');
    expect(env.anthropicApiKey).toBe('anthropic-key-value');
  });

  it('queries tenant_config with the correct tenant ID', async () => {
    await loadConfigFromSupabase('tenant-abc');
    expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-abc');
  });

  it('throws ConfigError when env vars are missing', async () => {
    delete process.env['SUPABASE_URL'];
    await expect(loadConfigFromSupabase('t1')).rejects.toThrow('SUPABASE_URL');
  });

  it('throws ConfigError when tenant not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(loadConfigFromSupabase('missing-tenant')).rejects.toThrow('missing-tenant');
  });
});
