import type { EpicSnapshot, Comment } from '../types/EpicSnapshot.js';

function renderComment(c: Comment, isOwner: boolean): string {
  const label = isOwner ? '[OWNER]' : '[OTHER]';
  return `**[${c.createdAt}] ${label} ${c.author} (on ${c.issueKey}):**\n${c.body}`;
}

export function buildUserMessage(snapshot: EpicSnapshot): string {
  const lines: string[] = [];

  // ── Epic overview ─────────────────────────────────────────────────────────
  lines.push(`## Epic: ${snapshot.epicKey} — ${snapshot.epicSummary}`);
  lines.push('');
  lines.push('### Overview');
  lines.push(`**Goal (from description):**`);
  lines.push(snapshot.epicDescription.trim() || '_No description provided._');
  lines.push('');
  lines.push(`**Due Date (JIRA field):** ${snapshot.epicDueDate ?? '_Not set — check description/comments for any mentioned target date_'}`);
  lines.push(`**Status:** ${snapshot.epicStatus}`);
  lines.push(`**Assignee:** ${snapshot.epicAssignee ?? '_Unassigned_'}`);
  lines.push(`**% Complete:** ${snapshot.percentComplete}% (${snapshot.childIssues.filter(c => c.statusBucket === 'done').length}/${snapshot.childIssues.length} stories done)`);
  lines.push(`**Run started at:** ${snapshot.runStartedAt}`);
  lines.push('');

  // ── Owner's update this week ──────────────────────────────────────────────
  lines.push("### Owner's Update This Week");
  if (snapshot.ownerUpdatesThisWeek.length === 0) {
    lines.push('_No comments from the Epic owner this week._');
  } else {
    for (const c of snapshot.ownerUpdatesThisWeek) {
      lines.push(renderComment(c, true));
      lines.push('');
    }
  }

  // ── Owner's update last week (context for delta) ──────────────────────────
  lines.push("### Owner's Update Last Week");
  if (snapshot.ownerUpdatesPreviousWeek.length === 0) {
    lines.push('_No comments from the Epic owner last week._');
  } else {
    for (const c of snapshot.ownerUpdatesPreviousWeek) {
      lines.push(renderComment(c, true));
      lines.push('');
    }
  }

  // ── Other comments this week (for context) ────────────────────────────────
  const otherCurrentWeek = snapshot.currentWeekComments.filter(
    (c) => c.authorAccountId !== snapshot.epicAssigneeAccountId,
  );
  if (otherCurrentWeek.length > 0) {
    lines.push("### Other Comments This Week");
    for (const c of otherCurrentWeek) {
      lines.push(renderComment(c, false));
      lines.push('');
    }
  }

  // ── Story breakdown ───────────────────────────────────────────────────────
  lines.push('### Story Breakdown');
  if (snapshot.childIssues.length === 0) {
    lines.push('_No child stories found._');
  } else {
    const noSP = snapshot.childIssues.filter(c => !c.hasStoryPoints && c.statusBucket !== 'done');
    const noAC = snapshot.childIssues.filter(c => !c.hasAcceptanceCriteria && c.statusBucket !== 'done');
    const noDesc = snapshot.childIssues.filter(c => !c.hasDescription && c.statusBucket !== 'done');
    const unassigned = snapshot.childIssues.filter(c => !c.assignee && c.statusBucket !== 'done');
    const stale = snapshot.childIssues.filter(c => c.ageInToDoDays > 14);

    lines.push('**Quality summary (open stories only):**');
    lines.push(`- Missing story points: ${noSP.length > 0 ? noSP.map(c => c.key).join(', ') : 'none'}`);
    lines.push(`- Missing AC: ${noAC.length > 0 ? noAC.map(c => c.key).join(', ') : 'none'}`);
    lines.push(`- Missing description: ${noDesc.length > 0 ? noDesc.map(c => c.key).join(', ') : 'none'}`);
    lines.push(`- Unassigned: ${unassigned.length > 0 ? unassigned.map(c => c.key).join(', ') : 'none'}`);
    lines.push(`- Stale in To Do (>14 days): ${stale.length > 0 ? stale.map(c => `${c.key}(${c.ageInToDoDays}d)`).join(', ') : 'none'}`);
    lines.push('');

    lines.push('**Full story list:**');
    lines.push('| Key | Summary | Status | Assignee | SP | Due | Flags |');
    lines.push('|-----|---------|--------|----------|----|-----|-------|');
    for (const child of snapshot.childIssues) {
      const flags: string[] = [];
      if (!child.hasStoryPoints && child.statusBucket !== 'done') flags.push('no-SP');
      if (!child.hasAcceptanceCriteria && child.statusBucket !== 'done') flags.push('no-AC');
      if (!child.hasDescription) flags.push('no-desc');
      if (!child.assignee && child.statusBucket !== 'done') flags.push('unassigned');
      if (!child.dueDate && child.statusBucket !== 'done') flags.push('no-due-date');
      if (child.ageInToDoDays > 14) flags.push(`stale-${child.ageInToDoDays}d`);
      lines.push(
        `| ${child.key} | ${child.summary} | ${child.status} | ${child.assignee ?? '-'} | ${child.storyPoints ?? '—'} | ${child.dueDate ?? '-'} | ${flags.join(', ') || '—'} |`,
      );
    }
  }
  lines.push('');

  lines.push('---');
  lines.push(
    `Read the owner's update above and respond as their EM. Call \`submit_epic_analysis\` with your structured response. epicKey must be "${snapshot.epicKey}".`,
  );

  return lines.join('\n');
}
