import { describe, it, expect } from 'vitest';
import {
  text,
  strong,
  em,
  paragraph,
  heading,
  bulletList,
  orderedList,
  inlineCard,
  rule,
  blockquote,
  buildEpicComment,
} from '../../src/jira/adfBuilder.js';
import type { AnalysisResult } from '../../src/types/AnalysisResult.js';

// --- Node constructors ---

describe('text()', () => {
  it('returns a text node with no marks by default', () => {
    const node = text('hello');
    expect(node).toEqual({ type: 'text', text: 'hello' });
  });

  it('adds strong mark when bold=true', () => {
    const node = text('bold', true);
    expect(node.marks).toContainEqual({ type: 'strong' });
  });

  it('adds em mark when italic=true', () => {
    const node = text('italic', false, true);
    expect(node.marks).toContainEqual({ type: 'em' });
  });

  it('adds both marks when bold and italic', () => {
    const node = text('both', true, true);
    expect(node.marks).toHaveLength(2);
  });

  it('omits marks property entirely when both false', () => {
    const node = text('plain');
    expect(node).not.toHaveProperty('marks');
  });
});

describe('strong()', () => {
  it('is shorthand for text with bold=true', () => {
    expect(strong('x')).toEqual(text('x', true));
  });
});

describe('em()', () => {
  it('is shorthand for text with italic=true', () => {
    expect(em('x')).toEqual(text('x', false, true));
  });
});

describe('paragraph()', () => {
  it('wraps nodes in a paragraph', () => {
    const p = paragraph(text('a'), text('b'));
    expect(p.type).toBe('paragraph');
    expect(p.content).toHaveLength(2);
  });
});

describe('heading()', () => {
  it('sets level attribute', () => {
    const h = heading(3, text('Title'));
    expect(h.type).toBe('heading');
    expect(h.attrs?.level).toBe(3);
    expect(h.content).toHaveLength(1);
  });
});

describe('bulletList()', () => {
  it('wraps each item in listItem > paragraph', () => {
    const list = bulletList([[text('a')], [text('b')]]);
    expect(list.type).toBe('bulletList');
    expect(list.content).toHaveLength(2);
    expect(list.content?.[0]?.type).toBe('listItem');
    expect(list.content?.[0]?.content?.[0]?.type).toBe('paragraph');
  });
});

describe('orderedList()', () => {
  it('wraps each item in listItem > paragraph', () => {
    const list = orderedList([[text('first')]]);
    expect(list.type).toBe('orderedList');
    expect(list.content?.[0]?.type).toBe('listItem');
  });
});

describe('inlineCard()', () => {
  it('sets url attr', () => {
    const card = inlineCard('https://jira.example.com/browse/CM-1');
    expect(card.type).toBe('inlineCard');
    expect(card.attrs?.url).toBe('https://jira.example.com/browse/CM-1');
  });
});

describe('rule()', () => {
  it('returns a horizontal rule node', () => {
    expect(rule()).toEqual({ type: 'rule' });
  });
});

describe('blockquote()', () => {
  it('wraps nodes in a blockquote', () => {
    const bq = blockquote(paragraph(text('quoted')));
    expect(bq.type).toBe('blockquote');
    expect(bq.content).toHaveLength(1);
  });
});

// --- buildEpicComment ---

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    epicKey: 'CM-100',
    weeklyUpdateFound: true,
    weeklyUpdateSummary: 'Engineer is on track.',
    currentWeekGoal: 'Finish feature X',
    lastWeekHighlights: ['Merged PR #42', 'Resolved bug in auth'],
    dueDateChange: null,
    emResponse: 'Good progress. Keep the momentum.',
    followUpQuestions: ['Any dependency risks?'],
    blockersRaised: [],
    blockersResolved: [],
    scheduleHealth: { assessment: 'ON_TRACK', rationale: 'Burn rate is steady.' },
    housekeepingItems: [],
    housekeepingNote: 'No housekeeping concerns.',
    ...overrides,
  };
}

describe('buildEpicComment()', () => {
  it('returns a valid ADF document with version 1 and type doc', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    expect(doc.version).toBe(1);
    expect(doc.type).toBe('doc');
    expect(Array.isArray(doc.content)).toBe(true);
  });

  it('starts with an H3 heading containing commentTag and runDate', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[EM-BOT]', '— Bot', '2026-05-07');
    const heading = doc.content[0];
    expect(heading?.type).toBe('heading');
    expect(heading?.attrs?.level).toBe(3);
    const headingText = heading?.content?.[0]?.text;
    expect(headingText).toContain('[EM-BOT]');
    expect(headingText).toContain('2026-05-07');
  });

  it('includes a blockquote with weeklyUpdateSummary when weeklyUpdateFound is true', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    const blockquoteNode = doc.content.find((n) => n.type === 'blockquote');
    expect(blockquoteNode).toBeDefined();
  });

  it('omits blockquote when weeklyUpdateFound is false', () => {
    const doc = buildEpicComment(
      makeAnalysis({ weeklyUpdateFound: false }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const blockquoteNode = doc.content.find((n) => n.type === 'blockquote');
    expect(blockquoteNode).toBeUndefined();
  });

  it('includes emResponse as a paragraph', () => {
    const analysis = makeAnalysis({ emResponse: 'Great job on the sprint.' });
    const doc = buildEpicComment(analysis, 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    const paragraphs = doc.content.filter((n) => n.type === 'paragraph');
    const found = paragraphs.some((p) =>
      p.content?.some((c) => c.type === 'text' && c.text?.includes('Great job on the sprint.')),
    );
    expect(found).toBe(true);
  });

  it('includes "This week:" paragraph when currentWeekGoal is not "Not stated"', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    const paragraphs = doc.content.filter((n) => n.type === 'paragraph');
    const found = paragraphs.some((p) =>
      p.content?.some((c) => c.text === 'This week: '),
    );
    expect(found).toBe(true);
  });

  it('omits "This week:" when currentWeekGoal is "Not stated"', () => {
    const doc = buildEpicComment(
      makeAnalysis({ currentWeekGoal: 'Not stated' }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const paragraphs = doc.content.filter((n) => n.type === 'paragraph');
    const found = paragraphs.some((p) =>
      p.content?.some((c) => c.text === 'This week: '),
    );
    expect(found).toBe(false);
  });

  it('includes "Last week:" heading and bullet list when highlights exist', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    const hasLastWeekPara = doc.content.some(
      (n) => n.type === 'paragraph' && n.content?.some((c) => c.text === 'Last week:'),
    );
    expect(hasLastWeekPara).toBe(true);
    const hasBullet = doc.content.some((n) => n.type === 'bulletList');
    expect(hasBullet).toBe(true);
  });

  it('omits last week section when lastWeekHighlights is empty', () => {
    const doc = buildEpicComment(
      makeAnalysis({ lastWeekHighlights: [] }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const hasLastWeekPara = doc.content.some(
      (n) => n.type === 'paragraph' && n.content?.some((c) => c.text === 'Last week:'),
    );
    expect(hasLastWeekPara).toBe(false);
  });

  it('includes dueDateChange paragraph when non-null', () => {
    const doc = buildEpicComment(
      makeAnalysis({ dueDateChange: 'Slipped to 2026-07-01' }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const paragraphs = doc.content.filter((n) => n.type === 'paragraph');
    const found = paragraphs.some((p) =>
      p.content?.some((c) => c.text?.includes('Slipped to 2026-07-01')),
    );
    expect(found).toBe(true);
  });

  it('includes "Things to consider" bullet list when followUpQuestions exist', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Things to consider')),
    );
    expect(hasHeading).toBe(true);
    expect(doc.content.some((n) => n.type === 'bulletList')).toBe(true);
  });

  it('omits "Things to consider" section when followUpQuestions is empty', () => {
    const doc = buildEpicComment(
      makeAnalysis({ followUpQuestions: [] }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Things to consider')),
    );
    expect(hasHeading).toBe(false);
  });

  it('includes Blockers surfaced section when blockersRaised is non-empty', () => {
    const doc = buildEpicComment(
      makeAnalysis({ blockersRaised: ['Dependency on team X'] }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Blockers surfaced')),
    );
    expect(hasHeading).toBe(true);
  });

  it('omits Blockers resolved section (removed from output)', () => {
    const doc = buildEpicComment(
      makeAnalysis({ blockersResolved: ['Auth dependency unblocked'] }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const hasHeading = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Blockers resolved')),
    );
    expect(hasHeading).toBe(false);
  });

  it('contains a rule separator', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    expect(doc.content.some((n) => n.type === 'rule')).toBe(true);
  });

  it('includes "Additional Notes" heading and scheduleHealth', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— Bot', '2026-05-07');
    const hasAdditional = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Additional Notes')),
    );
    expect(hasAdditional).toBe(true);
    const hasSchedule = doc.content.some(
      (n) => n.type === 'paragraph' && n.content?.some((c) => c.text?.includes('ON_TRACK')),
    );
    expect(hasSchedule).toBe(true);
  });

  it('includes Housekeeping section when housekeepingItems is non-empty', () => {
    const doc = buildEpicComment(
      makeAnalysis({
        housekeepingItems: [{ issueKey: 'CM-200', concern: 'Missing SP', detail: 'No story points set' }],
      }),
      'https://jira.example.com/browse/CM-100',
      '[TAG]',
      '— Bot',
      '2026-05-07',
    );
    const hasHousekeeping = doc.content.some(
      (n) => n.type === 'heading' && n.content?.some((c) => c.text?.includes('Housekeeping')),
    );
    expect(hasHousekeeping).toBe(true);
  });

  it('ends with signature paragraph in italic', () => {
    const doc = buildEpicComment(makeAnalysis(), 'https://jira.example.com/browse/CM-100', '[TAG]', '— EM Bot', '2026-05-07');
    const last = doc.content[doc.content.length - 1];
    expect(last?.type).toBe('paragraph');
    const sigNode = last?.content?.[0];
    expect(sigNode?.text).toBe('— EM Bot');
    expect(sigNode?.marks).toContainEqual({ type: 'em' });
  });
});
