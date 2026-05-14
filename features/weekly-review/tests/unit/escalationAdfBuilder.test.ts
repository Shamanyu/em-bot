import { describe, it, expect } from 'vitest';
import { buildEscalationComment } from '../../src/jira/escalationAdfBuilder.js';

// getNextMonday logic:
//   day=0 (Sun) → +1 → Mon
//   day=1 (Mon) → +7 → Mon
//   day=2 (Tue) → +6 → Mon
//   day=3 (Wed) → +5 → Mon
//   day=4 (Thu) → +4 → Mon
//   day=5 (Fri) → +3 → Mon
//   day=6 (Sat) → +2 → Mon

describe('buildEscalationComment — ADF structure', () => {
  it('returns a valid ADF document', () => {
    const doc = buildEscalationComment('acc-123', 'Alice', '[TAG]', '— Bot', '2026-05-08');
    expect(doc.version).toBe(1);
    expect(doc.type).toBe('doc');
    expect(Array.isArray(doc.content)).toBe(true);
  });

  it('starts with H3 heading containing commentTag and runDate', () => {
    const doc = buildEscalationComment('acc-123', 'Alice', '[EM-BOT]', '— Bot', '2026-05-08');
    const h = doc.content[0];
    expect(h?.type).toBe('heading');
    expect(h?.attrs?.level).toBe(3);
    const headingText = h?.content?.[0]?.text;
    expect(headingText).toContain('[EM-BOT]');
    expect(headingText).toContain('2026-05-08');
    expect(headingText).toContain('Weekly Update Missing');
  });

  it('second node is a paragraph with a mention node', () => {
    const doc = buildEscalationComment('acc-alice', 'Alice Smith', '[TAG]', '— Bot', '2026-05-09');
    const para = doc.content[1];
    expect(para?.type).toBe('paragraph');
    const mention = para?.content?.[0];
    expect(mention?.type).toBe('mention');
    expect(mention?.attrs?.id).toBe('acc-alice');
    expect(mention?.attrs?.text).toBe('@Alice Smith');
  });

  it('paragraph body mentions the next Monday deadline', () => {
    // 2026-05-08 is a Friday — next Monday is 2026-05-11
    const doc = buildEscalationComment('acc-alice', 'Alice', '[TAG]', '— Bot', '2026-05-08');
    const para = doc.content[1];
    const bodyText = para?.content?.[1]?.text ?? '';
    expect(bodyText).toContain('2026-05-11');
  });

  it('contains a bullet list of what to include', () => {
    const doc = buildEscalationComment('acc-123', 'Alice', '[TAG]', '— Bot', '2026-05-08');
    expect(doc.content.some((n) => n.type === 'bulletList')).toBe(true);
  });

  it('includes a horizontal rule', () => {
    const doc = buildEscalationComment('acc-123', 'Alice', '[TAG]', '— Bot', '2026-05-08');
    expect(doc.content.some((n) => n.type === 'rule')).toBe(true);
  });

  it('ends with the signature in italic', () => {
    const doc = buildEscalationComment('acc-123', 'Alice', '[TAG]', '— EM Bot', '2026-05-08');
    const last = doc.content[doc.content.length - 1];
    expect(last?.type).toBe('paragraph');
    const sigNode = last?.content?.[0];
    expect(sigNode?.text).toBe('— EM Bot');
    expect(sigNode?.marks).toContainEqual({ type: 'em' });
  });
});

describe('getNextMonday — date calculation', () => {
  const cases: Array<[string, string, string]> = [
    ['Sunday',    '2026-05-10', '2026-05-11'],
    ['Monday',    '2026-05-11', '2026-05-18'],
    ['Tuesday',   '2026-05-12', '2026-05-18'],
    ['Wednesday', '2026-05-13', '2026-05-18'],
    ['Thursday',  '2026-05-14', '2026-05-18'],
    ['Friday',    '2026-05-08', '2026-05-11'],
    ['Saturday',  '2026-05-09', '2026-05-11'],
  ];

  for (const [dayName, runDate, expectedMonday] of cases) {
    it(`computes next Monday correctly when runDate is a ${dayName} (${runDate})`, () => {
      const doc = buildEscalationComment('acc-x', 'User', '[TAG]', '— Bot', runDate);
      const para = doc.content[1];
      const bodyText = para?.content?.[1]?.text ?? '';
      expect(bodyText).toContain(expectedMonday);
    });
  }
});
