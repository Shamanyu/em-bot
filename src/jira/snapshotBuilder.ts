import type { JiraClient } from './client.js';
import type { CustomFields } from './customFields.js';
import { extractText } from './adfTextExtractor.js';
import { mapStatusCategory } from './statusMapper.js';
import { hasAcceptanceCriteria, ageInToDoDays, percentComplete } from './heuristics.js';
import { isInWindow, computeWindows } from '../lib/time.js';
import type {
  EpicSnapshot,
  ChildIssue,
  Comment,
  JiraIssueRaw,
  JiraCommentRaw,
} from '../types/EpicSnapshot.js';

export async function buildSnapshot(
  client: JiraClient,
  epicKey: string,
  customFields: CustomFields,
  commentTag: string,
  runStartedAt: Date,
  lookbackDays: number,
  baseUrl: string,
): Promise<EpicSnapshot> {
  const epic = await client.getIssue(epicKey);
  const fields = epic.fields;

  const children = await fetchChildren(client, epicKey, customFields);
  const allComments = await fetchAllComments(client, epicKey, children);

  const windows = computeWindows(runStartedAt, lookbackDays);

  const currentWeekComments = allComments.filter((c) =>
    isInWindow(new Date(c.createdAt), windows.currentStart, windows.currentEnd),
  );
  const previousWeekComments = allComments.filter((c) =>
    isInWindow(new Date(c.createdAt), windows.previousStart, windows.previousEnd),
  );

  const botInCurrent = currentWeekComments.filter((c) => c.body.startsWith(commentTag));
  const botCommentExistsThisWeek = botInCurrent.length > 0;
  const lastBotCommentAt =
    botInCurrent.length > 0 ? (botInCurrent[botInCurrent.length - 1]?.createdAt ?? null) : null;

  const epicDescription = extractText(fields['description'] as Parameters<typeof extractText>[0]);

  const mappedChildren: ChildIssue[] = children.map((child) => {
    const cf = child.fields;
    const statusObj = cf['status'] as { name: string; statusCategory: { key: string } };
    const statusBucket = mapStatusCategory(statusObj.statusCategory.key);
    const createdAt = cf['created'] as string;
    const descText = extractText(cf['description'] as Parameters<typeof extractText>[0]);
    const acText = descText;
    const childIssue: ChildIssue = {
      key: child.key,
      summary: (cf['summary'] as string) ?? '',
      issueType: (cf['issuetype'] as { name: string })?.name ?? '',
      status: statusObj.name ?? '',
      statusBucket,
      assignee: (cf['assignee'] as { displayName: string } | null)?.displayName ?? null,
      storyPoints:
        customFields.storyPointsField
          ? ((cf[customFields.storyPointsField] as number | null) ?? null)
          : null,
      dueDate: (cf['duedate'] as string | null) ?? null,
      url: `${baseUrl}/browse/${child.key}`,
      createdAt,
      updatedAt: cf['updated'] as string,
      hasDescription: descText.length > 0,
      hasAcceptanceCriteria: hasAcceptanceCriteria(acText),
      ageInToDoDays: ageInToDoDays({ statusBucket, createdAt }, runStartedAt),
    };
    return childIssue;
  });

  return {
    epicKey,
    epicSummary: (fields['summary'] as string) ?? '',
    epicDescription,
    epicStatus: (fields['status'] as { name: string })?.name ?? '',
    epicAssignee: (fields['assignee'] as { displayName: string } | null)?.displayName ?? null,
    epicReporter: (fields['reporter'] as { displayName: string } | null)?.displayName ?? null,
    epicStartDate: (fields['startdate'] as string | null) ?? null,
    epicDueDate: (fields['duedate'] as string | null) ?? null,
    epicLabels: (fields['labels'] as string[]) ?? [],
    epicComponents:
      ((fields['components'] as Array<{ name: string }>) ?? []).map((c) => c.name) ?? [],
    epicUrl: `${baseUrl}/browse/${epicKey}`,
    epicCreatedAt: fields['created'] as string,
    childIssues: mappedChildren,
    currentWeekComments,
    previousWeekComments,
    botCommentExistsThisWeek,
    lastBotCommentAt,
    percentComplete: percentComplete(mappedChildren),
    runStartedAt: runStartedAt.toISOString(),
  };
}

async function fetchChildren(
  client: JiraClient,
  epicKey: string,
  customFields: CustomFields,
): Promise<JiraIssueRaw[]> {
  const fields = [
    'summary',
    'status',
    'assignee',
    'issuetype',
    'created',
    'updated',
    'duedate',
    'description',
    'parent',
    customFields.storyPointsField,
    customFields.epicLinkField,
  ].filter(Boolean) as string[];

  // Method 1: parent field (next-gen projects)
  try {
    const res = await client.searchByJql(
      `parent = ${epicKey} ORDER BY created ASC`,
      fields,
      100,
    );
    if (res.issues.length > 0) return res.issues;
  } catch {
    // fall through
  }

  // Method 2: Epic Link custom field
  if (customFields.epicLinkField) {
    try {
      const res = await client.searchByJql(
        `"Epic Link" = ${epicKey} ORDER BY created ASC`,
        fields,
        100,
      );
      if (res.issues.length > 0) return res.issues;
    } catch {
      // fall through
    }
  }

  // Method 3: Agile API
  return client.getChildIssuesViaAgile(epicKey);
}

async function fetchAllComments(
  client: JiraClient,
  epicKey: string,
  children: JiraIssueRaw[],
): Promise<Comment[]> {
  const allRaw: Array<{ issueKey: string; raw: JiraCommentRaw }> = [];

  const epicComments = await client.getComments(epicKey);
  epicComments.forEach((c) => allRaw.push({ issueKey: epicKey, raw: c }));

  for (const child of children) {
    const childComments = await client.getComments(child.key);
    childComments.forEach((c) => allRaw.push({ issueKey: child.key, raw: c }));
  }

  return allRaw.map(({ issueKey, raw }) => ({
    issueKey,
    author: raw.author.displayName,
    authorAccountId: raw.author.accountId,
    createdAt: raw.created,
    body: extractText(raw.body as Parameters<typeof extractText>[0]),
  }));
}
