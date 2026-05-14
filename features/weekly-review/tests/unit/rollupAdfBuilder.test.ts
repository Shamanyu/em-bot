import { describe, it, expect } from 'vitest';
import { buildRollupComment } from '../../src/rollup/adfBuilder.js';
import type { TeamRollup } from '../../src/types/TeamRollup.js';

function makeRollup(overrides: Partial<TeamRollup> = {}): TeamRollup {
  return {
    runDate: '2026-05-07',
    epicCount: 0,
    updatesFound: 0,
    escalationsPosted: 0,
    skipped: 0,
    scheduleHealthCounts: { ON_TRACK: 0, AT_RISK: 0, LIKELY_TO_SLIP: 0, NO_DUE_DATE: 0 },
    epicsWithUpdates: [],
    epicsEscalated: [],
    failedEpics: [],
    narrativeSummary: 'No epics processed this run.',
    ...overrides,
  };
}

const BASE_URL = 'https://jira.example.com';
const TAG = '[EM-BOT]';
const SIG = '— EM Bot';

describe('buildRollupComment — ADF structure', () => {
  it('returns a valid ADF document', () => {
    const doc = buildRollupComment(makeRollup(), TAG, SIG, BASE_URL);
    expect(doc.version).toBe(1);
    expect(doc.type).toBe('doc');
    expect(Array.isArray(doc.content)).toBe(true);
  });

  it('starts with H3 heading containing commentTag and runDate', () => {
    const doc = buildRollupComment(makeRollup(), '[EM-BOT]', SIG, BASE_URL);
    const h = doc.content[0];
    expect(h?.type).toBe('heading');
    expect(h?.attrs?.level).toBe(3);
    const text = h?.content?.[0]?.text;
    expect(text).toContain('[EM-BOT]');
    expect(text).toContain('2026-05-07');
    expect(text).toContain('Team Rollup');
  });

  it('second node is a paragraph with the narrativeSummary', () => {
    const rollup = makeRollup({ narrativeSummary: 'All good.' });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const para = doc.content[1];
    expect(para?.type).toBe('paragraph');
    expect(para?.content?.[0]?.text).toBe('All good.');
  });

  it('ends with signature in italic', () => {
    const doc = buildRollupComment(makeRollup(), TAG, '— EM Bot', BASE_URL);
    const last = doc.content[doc.content.length - 1];
    expect(last?.type).toBe('paragraph');
    const sigNode = last?.content?.[0];
    expect(sigNode?.text).toBe('— EM Bot');
    expect(sigNode?.marks).toContainEqual({ type: 'em' });
  });

  it('contains a horizontal rule', () => {
    const doc = buildRollupComment(makeRollup(), TAG, SIG, BASE_URL);
    expect(doc.content.some((n) => n.type === 'rule')).toBe(true);
  });
});

describe('buildRollupComment — "Updates Responded To" section', () => {
  it('omits the section when epicsWithUpdates is empty', () => {
    const doc = buildRollupComment(makeRollup(), TAG, SIG, BASE_URL);
    const hasUpdatesHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Updates Responded To')),
    );
    expect(hasUpdatesHeading).toBe(false);
    expect(doc.content.some((n) => n.type === 'table')).toBe(false);
  });

  it('renders "Updates Responded To" heading and table when epicsWithUpdates is non-empty', () => {
    const rollup = makeRollup({
      epicsWithUpdates: [{
        epicKey: 'CM-1',
        epicSummary: 'Epic One',
        assignee: 'Alice',
        scheduleHealth: 'ON_TRACK',
        updateSummary: 'All done.',
      }],
    });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Updates Responded To')),
    );
    expect(hasHeading).toBe(true);
    expect(doc.content.some((n) => n.type === 'table')).toBe(true);
  });

  it('table has header row plus one data row per epic', () => {
    const rollup = makeRollup({
      epicsWithUpdates: [
        { epicKey: 'CM-1', epicSummary: 'A', assignee: 'Alice', scheduleHealth: 'ON_TRACK', updateSummary: 'ok' },
        { epicKey: 'CM-2', epicSummary: 'B', assignee: 'Bob', scheduleHealth: 'AT_RISK', updateSummary: 'at risk' },
      ],
    });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const table = doc.content.find((n) => n.type === 'table');
    // header + 2 data rows
    expect(table?.content).toHaveLength(3);
  });

  it('table header row uses tableHeader cells', () => {
    const rollup = makeRollup({
      epicsWithUpdates: [
        { epicKey: 'CM-1', epicSummary: 'A', assignee: null, scheduleHealth: 'NO_DUE_DATE', updateSummary: '' },
      ],
    });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const table = doc.content.find((n) => n.type === 'table');
    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
  });

  it('data rows use tableCell and contain inlineCard for epic URL', () => {
    const rollup = makeRollup({
      epicsWithUpdates: [
        { epicKey: 'CM-5', epicSummary: 'Epic Five', assignee: 'Carol', scheduleHealth: 'ON_TRACK', updateSummary: 'good' },
      ],
    });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const table = doc.content.find((n) => n.type === 'table');
    const dataRow = table?.content?.[1];
    expect(dataRow?.content?.[0]?.type).toBe('tableCell');
    const epicCell = dataRow?.content?.[0];
    const inlineCard = epicCell?.content?.[0]?.content?.[0];
    expect(inlineCard?.type).toBe('inlineCard');
    expect(inlineCard?.attrs?.url).toBe(`${BASE_URL}/browse/CM-5`);
  });

  it('shows "Unassigned" when assignee is null', () => {
    const rollup = makeRollup({
      epicsWithUpdates: [
        { epicKey: 'CM-1', epicSummary: 'A', assignee: null, scheduleHealth: 'NO_DUE_DATE', updateSummary: '' },
      ],
    });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const table = doc.content.find((n) => n.type === 'table');
    const assigneeCell = table?.content?.[1]?.content?.[1];
    expect(assigneeCell?.content?.[0]?.content?.[0]?.text).toBe('Unassigned');
  });
});

describe('buildRollupComment — escalated section', () => {
  it('omits escalated section when epicsEscalated is empty', () => {
    const doc = buildRollupComment(makeRollup(), TAG, SIG, BASE_URL);
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Escalated')),
    );
    expect(hasHeading).toBe(false);
  });

  it('renders "Escalated" heading and bullet list when epicsEscalated is non-empty', () => {
    const rollup = makeRollup({
      epicsEscalated: [{ epicKey: 'CM-7', epicSummary: 'Late Epic', assignee: 'Dave' }],
    });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Escalated')),
    );
    expect(hasHeading).toBe(true);
  });
});

describe('buildRollupComment — failed analyses section', () => {
  it('omits the section when failedEpics is empty', () => {
    const doc = buildRollupComment(makeRollup(), TAG, SIG, BASE_URL);
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Failed')),
    );
    expect(hasHeading).toBe(false);
  });

  it('renders "Failed Analyses" heading when failedEpics is non-empty', () => {
    const rollup = makeRollup({
      failedEpics: [{ epicKey: 'CM-9', reason: 'LLM timeout' }],
    });
    const doc = buildRollupComment(rollup, TAG, SIG, BASE_URL);
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Failed Analyses')),
    );
    expect(hasHeading).toBe(true);
  });
});
