import { describe, it, expect } from 'vitest';
import { buildUserMessage } from '../../src/llm/promptBuilder.js';
import snapshotOnTrack from '../fixtures/snapshot-on-track.json' assert { type: 'json' };
import snapshotAtRisk from '../fixtures/snapshot-at-risk.json' assert { type: 'json' };
import snapshotNoUpdate from '../fixtures/snapshot-no-update.json' assert { type: 'json' };
import type { EpicSnapshot } from '../../src/types/EpicSnapshot.js';

describe('buildUserMessage', () => {
  it('includes epic key in message for on-track snapshot', () => {
    const msg = buildUserMessage(snapshotOnTrack as EpicSnapshot);
    expect(msg).toContain('CM-100');
    expect(msg).toContain('AI Tutor Personalisation Engine');
  });

  it('includes child issue flags for at-risk snapshot', () => {
    const msg = buildUserMessage(snapshotAtRisk as EpicSnapshot);
    expect(msg).toContain('no-description');
    expect(msg).toContain('no-DoD');
    expect(msg).toContain('unassigned');
    expect(msg).toContain('stale-');
  });

  it('shows no-update message when currentWeekComments is empty', () => {
    const msg = buildUserMessage(snapshotNoUpdate as EpicSnapshot);
    expect(msg).toContain('No comments posted this week');
  });

  it('includes previous week comments', () => {
    const msg = buildUserMessage(snapshotAtRisk as EpicSnapshot);
    expect(msg).toContain('Will get spec signed off');
  });

  it('instruction line references epicKey', () => {
    const msg = buildUserMessage(snapshotOnTrack as EpicSnapshot);
    expect(msg).toContain('"CM-100"');
  });
});
