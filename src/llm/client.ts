import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages.js';

export class LlmClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async createMessage(
    params: MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    return this.client.messages.create(params);
  }
}
