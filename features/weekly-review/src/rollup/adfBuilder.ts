import type { AdfDocument, AdfNode } from '@shared/types/Adf.js';
import type { TeamRollup } from '../types/TeamRollup.js';
import {
  text,
  strong,
  em,
  paragraph,
  heading,
  bulletList,
  rule,
} from '../jira/adfBuilder.js';

const SCHEDULE_BADGE: Record<string, string> = {
  ON_TRACK: '✅',
  AT_RISK: '⚠️',
  LIKELY_TO_SLIP: '🔴',
  NO_DUE_DATE: '⬜',
};

export function buildRollupComment(
  rollup: TeamRollup,
  commentTag: string,
  signature: string,
  baseUrl: string,
): AdfDocument {
  const nodes: AdfNode[] = [];

  nodes.push(heading(3, text(`${commentTag} Team Rollup — ${rollup.runDate}`)));
  nodes.push(paragraph(text(rollup.narrativeSummary)));

  // Epics with updates responded to
  if (rollup.epicsWithUpdates.length > 0) {
    nodes.push(heading(4, text('Updates Responded To')));
    nodes.push(buildUpdatesTable(rollup.epicsWithUpdates, baseUrl));
  }

  // Friday escalations
  if (rollup.epicsEscalated.length > 0) {
    nodes.push(heading(4, text('Escalated — No Update Posted')));
    nodes.push(
      bulletList(
        rollup.epicsEscalated.map((e) => [
          { type: 'inlineCard', attrs: { url: `${baseUrl}/browse/${e.epicKey}` } } as AdfNode,
          text(` — ${e.assignee ?? 'Unassigned'} — no update this week`),
        ]),
      ),
    );
  }

  // Failed analyses
  if (rollup.failedEpics.length > 0) {
    nodes.push(heading(4, text('Failed Analyses')));
    nodes.push(
      bulletList(rollup.failedEpics.map((f) => [strong(f.epicKey), text(` — ${f.reason}`)])),
    );
  }

  nodes.push(rule());
  nodes.push(paragraph(em(signature)));

  return { version: 1, type: 'doc', content: nodes };
}

function buildUpdatesTable(
  epics: TeamRollup['epicsWithUpdates'],
  baseUrl: string,
): AdfNode {
  const headerRow: AdfNode = {
    type: 'tableRow',
    content: ['Epic', 'Assignee', 'Schedule', 'Update Summary'].map((h) => ({
      type: 'tableHeader',
      attrs: {},
      content: [paragraph(strong(h))],
    })),
  };

  const rows: AdfNode[] = epics.map((e) => ({
    type: 'tableRow',
    content: [
      {
        type: 'tableCell',
        attrs: {},
        content: [
          paragraph(
            { type: 'inlineCard', attrs: { url: `${baseUrl}/browse/${e.epicKey}` } } as AdfNode,
          ),
        ],
      },
      {
        type: 'tableCell',
        attrs: {},
        content: [paragraph(text(e.assignee ?? 'Unassigned'))],
      },
      {
        type: 'tableCell',
        attrs: {},
        content: [paragraph(strong(`${SCHEDULE_BADGE[e.scheduleHealth] ?? ''} ${e.scheduleHealth}`))],
      },
      {
        type: 'tableCell',
        attrs: {},
        content: [paragraph(text(e.updateSummary || '—'))],
      },
    ],
  }));

  return {
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: [headerRow, ...rows],
  };
}
