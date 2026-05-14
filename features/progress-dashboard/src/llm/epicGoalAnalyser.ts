import { readFileSync } from 'fs';
import type { LlmClient } from '@weekly-review/src/llm/client.js';
import { epicGoalTool } from './tools.js';
import type { EpicSnapshot, ChildIssue, Comment } from '@weekly-review/src/types/EpicSnapshot.js';
import { EpicGoalLlmOutputSchema, type EpicGoalLlmOutput } from '../types/DashboardData.js';
import type { DashboardConfig } from '../config/schema.js';
import type Anthropic from '@anthropic-ai/sdk';

export async function analyseEpicGoal(
  client: LlmClient,
  snapshot: EpicSnapshot,
  config: DashboardConfig,
): Promise<EpicGoalLlmOutput> {
  const systemPrompt = readFileSync(
    'features/progress-dashboard/src/prompts/epic-goals.md',
    'utf-8',
  );

  const recentComments = [...snapshot.currentWeekComments, ...snapshot.previousWeekComments]
    .slice(-10)
    .map((c: Comment) => `[${c.createdAt.slice(0, 10)} ${c.author}] ${c.body}`)
    .join('\n');

  const childSummary = snapshot.childIssues
    .map((c: ChildIssue) => `- ${c.key} [${c.statusBucket}] ${c.summary}` + (c.assignee ? ` (${c.assignee})` : ''))
    .join('\n');

  const userMessage =
    `Epic: ${snapshot.epicKey} — ${snapshot.epicSummary}\n` +
    `Due: ${snapshot.epicDueDate ?? 'not set'}\n` +
    `Assignee: ${snapshot.epicAssignee ?? 'unassigned'}\n` +
    `Progress: ${snapshot.percentComplete.toFixed(0)}% complete (${snapshot.childIssues.filter((c: ChildIssue) => c.statusBucket === 'done').length}/${snapshot.childIssues.length} stories done)\n\n` +
    `Description:\n${snapshot.epicDescription || '(none)'}\n\n` +
    (recentComments ? `Recent comments:\n${recentComments}\n\n` : 'No recent comments.\n\n') +
    `Child issues:\n${childSummary || '(none)'}\n\n` +
    `Call \`submit_epic_goal_summary\` with epicKey="${snapshot.epicKey}".`;

  for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
    const response = await client.createMessage({
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      system: systemPrompt,
      tools: [epicGoalTool],
      tool_choice: { type: 'tool', name: 'submit_epic_goal_summary' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = response.content.find(
      (b: Anthropic.ContentBlock) => b.type === 'tool_use',
    ) as Anthropic.ToolUseBlock | undefined;
    if (!toolUse) continue;

    const parsed = EpicGoalLlmOutputSchema.safeParse(toolUse.input);
    if (parsed.success) return parsed.data;
  }

  return {
    epicKey: snapshot.epicKey,
    oneLineSummary: snapshot.epicSummary,
    currentStatus: `${snapshot.percentComplete.toFixed(0)}% complete.`,
    scheduleHealth: 'NO_DUE_DATE',
    blockers: [],
  };
}
