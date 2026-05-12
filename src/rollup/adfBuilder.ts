import type { AdfDocument, AdfNode } from '../types/Adf.js';
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

const RISK_BADGE: Record<string, string> = {
  GREEN: '🟢',
  YELLOW: '🟡',
  RED: '🔴',
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

  // Risk distribution
  nodes.push(heading(4, text('Risk Distribution')));
  nodes.push(
    paragraph(
      strong('🔴 RED: '),
      text(`${rollup.riskCounts.RED}  `),
      strong('🟡 YELLOW: '),
      text(`${rollup.riskCounts.YELLOW}  `),
      strong('🟢 GREEN: '),
      text(`${rollup.riskCounts.GREEN}`),
    ),
  );

  // Epics by risk — ADF table
  nodes.push(heading(4, text('Epics by Risk')));
  if (rollup.epicsByRisk.length > 0) {
    nodes.push(buildRiskTable(rollup.epicsByRisk, baseUrl));
  } else {
    nodes.push(paragraph(em('No epics analysed.')));
  }

  // Missing updates
  if (rollup.missingUpdates.length > 0) {
    nodes.push(heading(4, text('Missing Updates')));
    nodes.push(
      bulletList(
        rollup.missingUpdates.map((key) => [
          { type: 'inlineCard', attrs: { url: `${baseUrl}/browse/${key}` } } as AdfNode,
          text(' — no update posted this week'),
        ]),
      ),
    );
  }

  // Top risks
  if (rollup.topRisksAcrossTeam.length > 0) {
    nodes.push(heading(4, text('Top Risks')));
    nodes.push(
      bulletList(
        rollup.topRisksAcrossTeam.map((r) => [
          { type: 'inlineCard', attrs: { url: `${baseUrl}/browse/${r.epicKey}` } } as AdfNode,
          text(` — ${r.rationale}`),
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

function buildRiskTable(
  epics: TeamRollup['epicsByRisk'],
  baseUrl: string,
): AdfNode {
  const headerRow: AdfNode = {
    type: 'tableRow',
    content: ['Epic', 'Assignee', 'Risk', 'Signal'].map((h) => ({
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
        content: [paragraph(strong(`${RISK_BADGE[e.riskLevel] ?? ''} ${e.riskLevel}`))],
      },
      {
        type: 'tableCell',
        attrs: {},
        content: [paragraph(text(e.signal))],
      },
    ],
  }));

  return {
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: [headerRow, ...rows],
  };
}
