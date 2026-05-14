import * as fs from 'fs';
import * as path from 'path';
import type { LlmClient } from './client.js';
import { epicAnalysisTool } from './tool.js';
import { buildUserMessage } from './promptBuilder.js';
import { AnalysisResultSchema, type AnalysisResult } from '../types/AnalysisResult.js';
import type { EpicSnapshot } from '../types/EpicSnapshot.js';
import { LlmAnalysisFailedError } from '../errors.js';
import type { Config } from '../config/schema.js';

function loadSystemPrompt(): string {
  const promptPath = path.join(process.cwd(), 'prompts', 'system-prompt.md');
  try {
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return 'You are EM Bot. Call submit_epic_analysis exactly once with your structured analysis.';
  }
}

export async function analyseEpic(
  client: LlmClient,
  snapshot: EpicSnapshot,
  config: Config,
): Promise<AnalysisResult> {
  const systemBase = loadSystemPrompt();
  const userMessage = buildUserMessage(snapshot);
  const maxAttempts = config.llm.maxRetries + 1;

  let systemPrompt = systemBase;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await client.createMessage({
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      system: systemPrompt,
      tools: [epicAnalysisTool],
      tool_choice: { type: 'tool', name: 'submit_epic_analysis' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      if (attempt < maxAttempts - 1) {
        systemPrompt =
          systemBase +
          '\n\nPrevious attempt did not call submit_epic_analysis. You MUST call it exactly once.';
        continue;
      }
      throw new LlmAnalysisFailedError(
        `Model did not call submit_epic_analysis after ${maxAttempts} attempts`,
      );
    }

    const parsed = AnalysisResultSchema.safeParse(toolUseBlock.input);
    if (!parsed.success) {
      if (attempt < maxAttempts - 1) {
        const issues = parsed.error.issues.map((i) => i.message).join('; ');
        systemPrompt =
          systemBase +
          `\n\nPrevious attempt had schema errors: ${issues}. Fix and call submit_epic_analysis again.`;
        continue;
      }
      throw new LlmAnalysisFailedError(
        `Analysis failed Zod validation: ${parsed.error.message}`,
      );
    }

    const result = parsed.data;

    if (result.epicKey !== snapshot.epicKey) {
      throw new LlmAnalysisFailedError(
        `Model returned wrong epicKey: expected ${snapshot.epicKey}, got ${result.epicKey}`,
      );
    }

    return result;
  }

  throw new LlmAnalysisFailedError(`Exhausted ${maxAttempts} attempts without valid result`);
}
