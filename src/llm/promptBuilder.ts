import type { EpicSnapshot } from '../types/EpicSnapshot.js';

export function buildUserMessage(snapshot: EpicSnapshot): string {
  const lines: string[] = [];

  // ── Primary signals ──────────────────────────────────────────────────────
  lines.push(`## Epic: ${snapshot.epicKey} — ${snapshot.epicSummary}`);
  lines.push('');
  lines.push('### Primary Signals');
  lines.push(`**Goal (from description):**`);
  lines.push(snapshot.epicDescription.trim() || '_No description provided. Goal is unknown._');
  lines.push('');
  lines.push(`**Due Date (JIRA field):** ${snapshot.epicDueDate ?? '_Not set — check description for any mentioned target date_'}`);
  lines.push(`**Status:** ${snapshot.epicStatus}`);
  lines.push(`**Assignee:** ${snapshot.epicAssignee ?? '_Unassigned_'}`);
  lines.push(`**% Complete:** ${snapshot.percentComplete}% (${snapshot.childIssues.filter(c => c.statusBucket === 'done').length}/${snapshot.childIssues.length} stories done)`);
  lines.push(`**Start Date:** ${snapshot.epicStartDate ?? 'Not set'}`);
  lines.push(`**Labels:** ${snapshot.epicLabels.join(', ') || 'None'}`);
  lines.push(`**Run started at:** ${snapshot.runStartedAt}`);
  lines.push('');

  // ── Story breakdown ───────────────────────────────────────────────────────
  lines.push('### Story Breakdown');
  if (snapshot.childIssues.length === 0) {
    lines.push('_No child stories found._');
  } else {
    // Summary counts
    const noSP = snapshot.childIssues.filter(c => !c.hasStoryPoints && c.statusBucket !== 'done');
    const noAC = snapshot.childIssues.filter(c => !c.hasAcceptanceCriteria && c.statusBucket !== 'done');
    const noDesc = snapshot.childIssues.filter(c => !c.hasDescription && c.statusBucket !== 'done');
    const unassigned = snapshot.childIssues.filter(c => !c.assignee && c.statusBucket !== 'done');
    const stale = snapshot.childIssues.filter(c => c.ageInToDoDays > 14);

    lines.push('**Quality summary (open stories only):**');
    lines.push(`- Missing story points: **${noSP.length}** ${noSP.length > 0 ? '⚠️ ' + noSP.map(c => c.key).join(', ') : '✓'}`);
    lines.push(`- Missing Definition of Done / AC: **${noAC.length}** ${noAC.length > 0 ? '⚠️ ' + noAC.map(c => c.key).join(', ') : '✓'}`);
    lines.push(`- Missing description: **${noDesc.length}** ${noDesc.length > 0 ? '⚠️ ' + noDesc.map(c => c.key).join(', ') : '✓'}`);
    lines.push(`- Unassigned: **${unassigned.length}** ${unassigned.length > 0 ? '⚠️ ' + unassigned.map(c => c.key).join(', ') : '✓'}`);
    lines.push(`- Stale in To Do (>14 days): **${stale.length}** ${stale.length > 0 ? '⚠️ ' + stale.map(c => `${c.key}(${c.ageInToDoDays}d)`).join(', ') : '✓'}`);
    lines.push('');

    lines.push('**Full story list:**');
    lines.push('| Key | Summary | Status | Assignee | SP | Due | Flags |');
    lines.push('|-----|---------|--------|----------|----|-----|-------|');
    for (const child of snapshot.childIssues) {
      const flags: string[] = [];
      if (!child.hasStoryPoints && child.statusBucket !== 'done') flags.push('no-SP');
      if (!child.hasAcceptanceCriteria && child.statusBucket !== 'done') flags.push('no-DoD');
      if (!child.hasDescription) flags.push('no-description');
      if (!child.assignee && child.statusBucket !== 'done') flags.push('unassigned');
      if (!child.dueDate && child.statusBucket !== 'done') flags.push('no-due-date');
      if (child.ageInToDoDays > 14) flags.push(`stale-${child.ageInToDoDays}d`);
      lines.push(
        `| ${child.key} | ${child.summary} | ${child.status} | ${child.assignee ?? '-'} | ${child.storyPoints ?? '—'} | ${child.dueDate ?? '-'} | ${flags.join(', ') || '—'} |`,
      );
    }
  }
  lines.push('');

  // ── This week's comments ──────────────────────────────────────────────────
  lines.push("### This Week's Comments");
  if (snapshot.currentWeekComments.length === 0) {
    lines.push('_No comments posted this week. This is a significant signal — the engineer has not communicated progress._');
  } else {
    for (const c of snapshot.currentWeekComments) {
      lines.push(`**[${c.createdAt}] ${c.author} (on ${c.issueKey}):**`);
      lines.push(c.body);
      lines.push('');
    }
  }

  // ── Previous week's comments ──────────────────────────────────────────────
  lines.push("### Previous Week's Comments");
  if (snapshot.previousWeekComments.length === 0) {
    lines.push('_No comments from the previous week either._');
  } else {
    for (const c of snapshot.previousWeekComments) {
      lines.push(`**[${c.createdAt}] ${c.author} (on ${c.issueKey}):**`);
      lines.push(c.body);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(
    `Analyse the above Epic snapshot and call \`submit_epic_analysis\` with your structured analysis. epicKey must be "${snapshot.epicKey}". Remember: parse the goal and due date from the description text if the JIRA fields are absent or vague.`,
  );

  return lines.join('\n');
}
