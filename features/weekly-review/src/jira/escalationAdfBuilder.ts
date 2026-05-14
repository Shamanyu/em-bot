import type { AdfNode, AdfDocument } from '@shared/types/Adf.js';
import { text, em, strong, paragraph, heading, rule } from './adfBuilder.js';

function mention(accountId: string, displayName: string): AdfNode {
  return {
    type: 'mention',
    attrs: { id: accountId, text: `@${displayName}` },
  };
}

export function buildEscalationComment(
  epicAssigneeAccountId: string,
  epicAssignee: string,
  commentTag: string,
  signature: string,
  runDate: string,
): AdfDocument {
  const nextMonday = getNextMonday(runDate);
  const nodes: AdfNode[] = [];

  nodes.push(heading(3, text(`${commentTag} Weekly Update Missing — ${runDate}`)));

  nodes.push(
    paragraph(
      mention(epicAssigneeAccountId, epicAssignee),
      text(
        ` No weekly update has been posted on this Epic for the past two weeks. ` +
        `Please post an update by ${nextMonday} covering both weeks — ` +
        `your goals, what was accomplished, any blockers, and any changes to the timeline.`,
      ),
    ),
  );

  nodes.push(paragraph(strong('What to include:')));
  nodes.push({
    type: 'bulletList',
    content: [
      {
        type: 'listItem',
        content: [paragraph(text('Goal for the coming week'))],
      },
      {
        type: 'listItem',
        content: [paragraph(text('Key progress from the past two weeks'))],
      },
      {
        type: 'listItem',
        content: [paragraph(text('Any blockers or risks'))],
      },
      {
        type: 'listItem',
        content: [paragraph(text('Any changes to the Epic due date or scope'))],
      },
    ],
  });

  nodes.push(rule());
  nodes.push(paragraph(em(signature)));

  return { version: 1, type: 'doc', content: nodes };
}

function getNextMonday(runDate: string): string {
  const d = new Date(runDate);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().split('T')[0] ?? runDate;
}
