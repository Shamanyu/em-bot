import type { AdfNode, AdfDocument } from '../types/Adf.js';
import type { AnalysisResult } from '../types/AnalysisResult.js';

// --- Node constructors ---

export function text(content: string, bold = false, italic = false): AdfNode {
  const marks: AdfNode['marks'] = [];
  if (bold) marks.push({ type: 'strong' });
  if (italic) marks.push({ type: 'em' });
  return { type: 'text', text: content, ...(marks.length > 0 ? { marks } : {}) };
}

export function strong(content: string): AdfNode {
  return text(content, true);
}

export function em(content: string): AdfNode {
  return text(content, false, true);
}

export function paragraph(...nodes: AdfNode[]): AdfNode {
  return { type: 'paragraph', content: nodes };
}

export function heading(level: 1 | 2 | 3 | 4 | 5 | 6, ...nodes: AdfNode[]): AdfNode {
  return { type: 'heading', attrs: { level }, content: nodes };
}

export function bulletList(items: AdfNode[][]): AdfNode {
  return {
    type: 'bulletList',
    content: items.map((itemNodes) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: itemNodes }],
    })),
  };
}

export function orderedList(items: AdfNode[][]): AdfNode {
  return {
    type: 'orderedList',
    content: items.map((itemNodes) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: itemNodes }],
    })),
  };
}

export function inlineCard(url: string): AdfNode {
  return { type: 'inlineCard', attrs: { url } };
}

export function rule(): AdfNode {
  return { type: 'rule' };
}

// --- Risk badge ---

const RISK_BADGE: Record<string, string> = {
  GREEN: '🟢 GREEN',
  YELLOW: '🟡 YELLOW',
  RED: '🔴 RED',
};

// --- Per-Epic comment ---

export function buildEpicComment(
  analysis: AnalysisResult,
  epicUrl: string,
  commentTag: string,
  signature: string,
  runDate: string,
): AdfDocument {
  const badge = RISK_BADGE[analysis.overallRiskLevel] ?? analysis.overallRiskLevel;
  const nodes: AdfNode[] = [];

  // H3 heading
  nodes.push(heading(3, text(`${commentTag} Weekly Analysis — ${runDate} `), strong(badge)));

  // Risk rationale
  nodes.push(paragraph(text(analysis.overallRiskRationale)));

  nodes.push(rule());

  // Goal & DoD
  nodes.push(heading(4, text('Goal & Definition of Done')));
  nodes.push(
    bulletList([
      [
        strong('Goal Clarity: '),
        text(`${analysis.goalClarity.rating} — ${analysis.goalClarity.observation}`),
        ...(analysis.goalClarity.suggestion
          ? [text(` Suggestion: ${analysis.goalClarity.suggestion}`)]
          : []),
      ],
      [
        strong('Definition of Done: '),
        text(`${analysis.definitionOfDone.rating} — ${analysis.definitionOfDone.observation}`),
        ...(analysis.definitionOfDone.suggestion
          ? [text(` Suggestion: ${analysis.definitionOfDone.suggestion}`)]
          : []),
      ],
    ]),
  );

  // Story Breakdown
  nodes.push(heading(4, text('Story Breakdown')));
  nodes.push(paragraph(text(analysis.storyBreakdown.observation)));
  if (analysis.storyBreakdown.issuesFlagged.length > 0) {
    nodes.push(
      bulletList(
        analysis.storyBreakdown.issuesFlagged.map((f) => [
          inlineCard(`${epicUrl.replace(/\/browse\/.*/, '')}/browse/${f.issueKey}`),
          text(` ${f.concern}: ${f.detail}`),
        ]),
      ),
    );
  }

  // Schedule Health
  nodes.push(heading(4, text('Schedule Health')));
  nodes.push(
    paragraph(strong(`${analysis.scheduleHealth.assessment} — `), text(analysis.scheduleHealth.rationale)),
  );

  // This Week's Progress
  nodes.push(heading(4, text("This Week's Progress")));
  if (!analysis.weeklyProgress.updatePosted) {
    nodes.push(paragraph(em('No update posted this week.')));
  } else {
    nodes.push(paragraph(text(analysis.weeklyProgress.summary)));
    if (analysis.weeklyProgress.blockersRaised.length > 0) {
      nodes.push(paragraph(strong('Blockers raised: ')));
      nodes.push(bulletList(analysis.weeklyProgress.blockersRaised.map((b) => [text(b)])));
    }
    if (analysis.weeklyProgress.blockersResolved.length > 0) {
      nodes.push(paragraph(strong('Blockers resolved: ')));
      nodes.push(bulletList(analysis.weeklyProgress.blockersResolved.map((b) => [text(b)])));
    }
  }

  // Week-over-Week
  nodes.push(heading(4, text('Week-over-Week')));
  nodes.push(
    paragraph(strong('Velocity trend: '), text(analysis.weekOverWeekDelta.velocityTrend)),
  );
  nodes.push(paragraph(text(analysis.weekOverWeekDelta.rationale)));
  if (analysis.weekOverWeekDelta.commitmentsMet.length > 0) {
    nodes.push(paragraph(strong('Commitments met:')));
    nodes.push(bulletList(analysis.weekOverWeekDelta.commitmentsMet.map((c) => [text(c)])));
  }
  if (analysis.weekOverWeekDelta.commitmentsMissed.length > 0) {
    nodes.push(paragraph(strong('Commitments missed:')));
    nodes.push(bulletList(analysis.weekOverWeekDelta.commitmentsMissed.map((c) => [text(c)])));
  }

  // Recommendations
  nodes.push(heading(4, text('Recommendations')));
  nodes.push(
    orderedList(
      analysis.recommendations.map((r) => [
        strong(`[${r.priority}] `),
        text(`${r.action} `),
        em(`(${r.audience})`),
      ]),
    ),
  );

  nodes.push(rule());
  nodes.push(paragraph(em(signature)));

  return { version: 1, type: 'doc', content: nodes };
}
