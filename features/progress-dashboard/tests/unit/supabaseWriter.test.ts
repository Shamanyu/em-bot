import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { upsertDashboardData, markRunFailed } from '../../src/output/supabaseWriter.js';
import type { DashboardPayload } from '../../src/types/DashboardData.js';

const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  process.env['SUPABASE_URL'] = 'https://test.supabase.co';
  process.env['SUPABASE_SERVICE_KEY'] = 'service-key';

  mockEq.mockReturnValue({ single: mockSingle });
  mockSingle.mockResolvedValue({
    data: { schedule_days: [1, 2, 3, 4, 5], schedule_time_utc: '10:30' },
    error: null,
  });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  mockUpsert.mockResolvedValue({ error: null });

  vi.mocked(createClient).mockReturnValue({
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
      select: mockSelect,
      update: mockUpdate,
    }),
  } as unknown as ReturnType<typeof createClient>);
});

const samplePayload: DashboardPayload = {
  generatedAt: '2026-05-14T10:30:00.000Z',
  teamProgress: {
    headline: 'Shipped 5 items.',
    themes: [],
    periodStart: '2026-04-14',
    periodEnd: '2026-05-14',
    totalIssues: 5,
  },
  teamGoals: [],
  weeklyGoals: [],
};

describe('upsertDashboardData', () => {
  it('calls upsert with correct tenant_id and payload', async () => {
    await upsertDashboardData('tenant-123', samplePayload);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-123',
        run_status: 'success',
        generated_at: '2026-05-14T10:30:00.000Z',
      }),
    );
  });

  it('throws if Supabase upsert returns an error', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB error' } });
    await expect(upsertDashboardData('t1', samplePayload)).rejects.toThrow('DB error');
  });

  it('throws if env vars are missing', async () => {
    delete process.env['SUPABASE_URL'];
    await expect(upsertDashboardData('t1', samplePayload)).rejects.toThrow('SUPABASE_URL');
  });
});

describe('markRunFailed', () => {
  it('upserts with run_status failed and error_msg', async () => {
    await markRunFailed('tenant-456', 'Something broke');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-456',
        run_status: 'failed',
        error_msg: 'Something broke',
      }),
    );
  });

  it('silently returns when env vars are missing', async () => {
    delete process.env['SUPABASE_URL'];
    await expect(markRunFailed('t1', 'err')).resolves.toBeUndefined();
  });
});
