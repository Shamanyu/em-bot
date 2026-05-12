import { describe, it, expect } from 'vitest';
import { extractText } from '../../src/jira/adfTextExtractor.js';
import type { AdfNode } from '../../src/types/Adf.js';

describe('extractText', () => {
  it('extracts text from a paragraph', () => {
    const node: AdfNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }],
    };
    expect(extractText(node)).toBe('Hello world');
  });

  it('joins multiple paragraphs with newline', () => {
    const node: AdfNode = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    const result = extractText(node);
    expect(result).toContain('First');
    expect(result).toContain('Second');
  });

  it('extracts URL from inlineCard', () => {
    const node: AdfNode = {
      type: 'paragraph',
      content: [{ type: 'inlineCard', attrs: { url: 'https://example.com/CM-1' } }],
    };
    expect(extractText(node)).toBe('https://example.com/CM-1');
  });

  it('returns empty string for null input', () => {
    expect(extractText(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(extractText(undefined)).toBe('');
  });

  it('handles deep nesting', () => {
    const node: AdfNode = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'nested item' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractText(node)).toBe('nested item');
  });

  it('handles hardBreak with newline', () => {
    const node: AdfNode = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Line 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Line 2' },
      ],
    };
    const result = extractText(node);
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
  });

  it('handles mention node', () => {
    const node: AdfNode = {
      type: 'paragraph',
      content: [{ type: 'mention', attrs: { text: '@Priya' } }],
    };
    expect(extractText(node)).toBe('@Priya');
  });
});
