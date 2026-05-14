import { readFileSync } from 'fs';
import type { LlmClient } from '@weekly-review/src/llm/client.js';
import type Anthropic from '@anthropic-ai/sdk';
import { teamProgressTool } from './tools.js';
import type { CompletedIssue } from '../jira/completedIssuesFetcher.js';
import { TeamProgressLlmOutputSchema, type TeamProgressLlmOutput } from '../types/DashboardData.js';
import type { DashboardConfig } from '../config/schema.js';

export async function analyseTeamProgress(
  client: LlmClient,
  issues: CompletedIssue[],
  lookbackDays: number,
  config: DashboardConfig,
): Promise<TeamProgressLlmOutput> {
  const systemPrompt = readFileSync(
    'features/progress-dashboard/src/prompts/team-progress.md',
    'utf-8',
  ).replace('{lookbackDays}', String(lookbackDays));

  const issueList = issues
    .map(
      (i) =>
        `- ${i.key} [${i.issueType}] ${i.summary}` +
        (i.assignee ? ` (${i.assignee})` : '') +
        (i.parentKey ? ` parent:${i.parentKey}` : '') +
        (i.labels.length > 0 ? ` labels:${i.labels.join(',')}` : '') +
        (i.components.length > 0 ? ` components:${i.components.join(',')}` : ''),
    )
    .join('\n');

  const userMessage = `Here are ${issues.length} completed issues from the past ${lookbackDays} days:\n\n${issueList}\n\nCall \`submit_team_progress\` now.`;

  for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
    const response = await client.createMessage({
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      system: systemPrompt,
      tools: [teamProgressTool],
      tool_choice: { type: 'tool', name: 'submit_team_progress' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = response.content.find(
      (b: Anthropic.ContentBlock) => b.type === 'tool_use',
    ) as Anthropic.ToolUseBlock | undefined;
    if (!toolUse) continue;

    const parsed = TeamProgressLlmOutputSchema.safeParse(toolUse.input);
    if (parsed.success) return parsed.data;
  }

  throw new Error('LLM failed to produce valid team progress analysis after retries');
}
