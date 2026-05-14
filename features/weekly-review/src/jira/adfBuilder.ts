import type { AdfNode, AdfDocument } from '@shared/types/Adf.js';
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

export function blockquote(...nodes: AdfNode[]): AdfNode {
  return { type: 'blockquote', content: nodes };
}

// --- Per-Epic comment ---

export function buildEpicComment(
  analysis: AnalysisResult,
  epicUrl: string,
  commentTag: string,
  signature: string,
  runDate: string,
): AdfDocument {
  const nodes: AdfNode[] = [];

  // H3 heading
  nodes.push(heading(3, text(`${commentTag} EM Response — ${runDate}`)));

  // Owner's update summary (quoted context)
  if (analysis.weeklyUpdateFound && analysis.weeklyUpdateSummary) {
    nodes.push(blockquote(paragraph(em(analysis.weeklyUpdateSummary))));
  }

  // Primary EM response
  nodes.push(paragraph(text(analysis.emResponse)));

  // Current week goal and last week highlights
  if (analysis.currentWeekGoal && analysis.currentWeekGoal !== 'Not stated') {
    nodes.push(paragraph(strong('This week: '), text(analysis.currentWeekGoal)));
  }
  if (analysis.lastWeekHighlights.length > 0) {
    nodes.push(paragraph(strong('Last week:')));
    nodes.push(bulletList(analysis.lastWeekHighlights.map((h) => [text(h)])));
  }
  if (analysis.dueDateChange) {
    nodes.push(paragraph(strong('Due date change: '), text(analysis.dueDateChange)));
  }

  // Follow-up questions
  if (analysis.followUpQuestions.length > 0) {
    nodes.push(heading(4, text('Questions for next 1:1')));
    nodes.push(orderedList(analysis.followUpQuestions.map((q) => [text(q)])));
  }

  // Blockers
  if (analysis.blockersRaised.length > 0) {
    nodes.push(heading(4, text('Blockers surfaced')));
    nodes.push(bulletList(analysis.blockersRaised.map((b) => [text(b)])));
  }
  if (analysis.blockersResolved.length > 0) {
    nodes.push(heading(4, text('Blockers resolved')));
    nodes.push(bulletList(analysis.blockersResolved.map((b) => [text(b)])));
  }

  nodes.push(rule());

  // Secondary: additional notes
  nodes.push(heading(4, text('Additional Notes')));
  nodes.push(
    paragraph(strong(`Schedule: ${analysis.scheduleHealth.assessment} — `), text(analysis.scheduleHealth.rationale)),
  );

  if (analysis.housekeepingItems.length > 0) {
    nodes.push(heading(4, text('Housekeeping')));
    nodes.push(
      bulletList(
        analysis.housekeepingItems.map((f) => [
          inlineCard(`${epicUrl.replace(/\/browse\/.*/, '')}/browse/${f.issueKey}`),
          text(` ${f.concern}: ${f.detail}`),
        ]),
      ),
    );
  }
  if (analysis.housekeepingNote) {
    nodes.push(paragraph(em(analysis.housekeepingNote)));
  }

  nodes.push(rule());
  nodes.push(paragraph(em(signature)));

  return { version: 1, type: 'doc', content: nodes };
}
