import { readFileSync } from 'fs';
import type { LlmClient } from '@weekly-review/src/llm/client.js';
import { personWeeklyGoalTool } from './tools.js';
import type { EpicSnapshot, Comment } from '@weekly-review/src/types/EpicSnapshot.js';
import {
  PersonWeeklyGoalLlmOutputSchema,
  type PersonWeeklyGoalLlmOutput,
} from '../types/DashboardData.js';
import type { DashboardConfig } from '../config/schema.js';
import type Anthropic from '@anthropic-ai/sdk';

export async function analyseWeeklyGoal(
  client: LlmClient,
  snapshot: EpicSnapshot,
  config: DashboardConfig,
): Promise<PersonWeeklyGoalLlmOutput> {
  if (snapshot.ownerUpdatesThisWeek.length === 0) {
    return {
      epicKey: snapshot.epicKey,
      currentStateOneLiner: buildNoUpdateState(snapshot),
      thisWeekGoal: '',
      updateMissing: true,
    };
  }

  const systemPrompt = readFileSync(
    'features/progress-dashboard/src/prompts/weekly-goals.md',
    'utf-8',
  );

  const ownerUpdates = snapshot.ownerUpdatesThisWeek
    .map((c: Comment) => `[${c.createdAt.slice(0, 10)}] ${c.body}`)
    .join('\n\n');

  const userMessage =
    `Epic: ${snapshot.epicKey} — ${snapshot.epicSummary}\n` +
    `Due: ${snapshot.epicDueDate ?? 'not set'}\n` +
    `Progress: ${snapshot.percentComplete.toFixed(0)}% complete\n\n` +
    `Owner's update this week:\n${ownerUpdates}\n\n` +
    `Call \`submit_person_weekly_goal\` with epicKey="${snapshot.epicKey}".`;

  for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
    const response = await client.createMessage({
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      system: systemPrompt,
      tools: [personWeeklyGoalTool],
      tool_choice: { type: 'tool', name: 'submit_person_weekly_goal' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = response.content.find(
      (b: Anthropic.ContentBlock) => b.type === 'tool_use',
    ) as Anthropic.ToolUseBlock | undefined;
    if (!toolUse) continue;

    const parsed = PersonWeeklyGoalLlmOutputSchema.safeParse(toolUse.input);
    if (parsed.success) return parsed.data;
  }

  return {
    epicKey: snapshot.epicKey,
    currentStateOneLiner: buildNoUpdateState(snapshot),
    thisWeekGoal: '',
    updateMissing: false,
  };
}

function buildNoUpdateState(snapshot: EpicSnapshot): string {
  const pct = snapshot.percentComplete.toFixed(0);
  const due = snapshot.epicDueDate ? ` due ${snapshot.epicDueDate}` : '';
  return `${pct}% complete${due}.`;
}
