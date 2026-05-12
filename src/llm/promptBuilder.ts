import type { EpicSnapshot } from '../types/EpicSnapshot.js';

export function buildUserMessage(snapshot: EpicSnapshot): string {
  const lines: string[] = [];

  lines.push(`## Epic: ${snapshot.epicKey}`);
  lines.push(`**Summary:** ${snapshot.epicSummary}`);
  lines.push(`**Status:** ${snapshot.epicStatus}`);
  lines.push(`**Assignee:** ${snapshot.epicAssignee ?? 'Unassigned'}`);
  lines.push(`**Reporter:** ${snapshot.epicReporter ?? 'Unknown'}`);
  lines.push(`**Due Date:** ${snapshot.epicDueDate ?? 'None'}`);
  lines.push(`**Start Date:** ${snapshot.epicStartDate ?? 'None'}`);
  lines.push(`**Labels:** ${snapshot.epicLabels.join(', ') || 'None'}`);
  lines.push(`**Components:** ${snapshot.epicComponents.join(', ') || 'None'}`);
  lines.push(`**Created:** ${snapshot.epicCreatedAt}`);
  lines.push(`**% Complete:** ${snapshot.percentComplete}%`);
  lines.push(`**Run started at:** ${snapshot.runStartedAt}`);
  lines.push('');

  lines.push('### Description');
  lines.push(snapshot.epicDescription || '_No description provided._');
  lines.push('');

  lines.push('### Child Issues');
  if (snapshot.childIssues.length === 0) {
    lines.push('_No child issues found._');
  } else {
    lines.push('| Key | Summary | Type | Status | Assignee | Points | Due | Flags |');
    lines.push('|-----|---------|------|--------|----------|--------|-----|-------|');
    for (const child of snapshot.childIssues) {
      const flags: string[] = [];
      if (!child.hasDescription) flags.push('no-description');
      if (!child.hasAcceptanceCriteria) flags.push('no-AC');
      if (!child.assignee && child.statusBucket !== 'done') flags.push('unassigned');
      if (!child.dueDate && child.statusBucket !== 'done') flags.push('no-due-date');
      if (child.ageInToDoDays > 14) flags.push(`stale-todo-${child.ageInToDoDays}d`);
      lines.push(
        `| ${child.key} | ${child.summary} | ${child.issueType} | ${child.status} | ${child.assignee ?? '-'} | ${child.storyPoints ?? '-'} | ${child.dueDate ?? '-'} | ${flags.join(', ')} |`,
      );
    }
  }
  lines.push('');

  lines.push('### This Week\'s Comments (current window)');
  if (snapshot.currentWeekComments.length === 0) {
    lines.push('_No comments in the current week window._');
  } else {
    for (const c of snapshot.currentWeekComments) {
      lines.push(`**[${c.createdAt}] ${c.author} (on ${c.issueKey}):**`);
      lines.push(c.body);
      lines.push('');
    }
  }

  lines.push('### Previous Week\'s Comments');
  if (snapshot.previousWeekComments.length === 0) {
    lines.push('_No comments in the previous week window._');
  } else {
    for (const c of snapshot.previousWeekComments) {
      lines.push(`**[${c.createdAt}] ${c.author} (on ${c.issueKey}):**`);
      lines.push(c.body);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(
    `Analyse the above Epic snapshot and call \`submit_epic_analysis\` with your structured analysis. epicKey must be "${snapshot.epicKey}".`,
  );

  return lines.join('\n');
}
