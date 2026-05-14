import type { AdfNode } from '../types/Adf.js';

const BLOCK_NODES = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock']);

export function extractText(node: AdfNode | null | undefined): string {
  if (!node) return '';

  const parts: string[] = [];
  visitNode(node, parts);
  return parts.join('').trim();
}

function visitNode(node: AdfNode, parts: string[]): void {
  if (node.type === 'text') {
    parts.push(node.text ?? '');
    return;
  }

  if (node.type === 'hardBreak') {
    parts.push('\n');
    return;
  }

  if (node.type === 'inlineCard') {
    const url = (node.attrs?.['url'] as string) ?? '';
    parts.push(url);
    return;
  }

  if (node.type === 'mention') {
    const name = (node.attrs?.['text'] as string) ?? (node.attrs?.['id'] as string) ?? '@user';
    parts.push(name.startsWith('@') ? name : `@${name}`);
    return;
  }

  if (node.content) {
    for (const child of node.content) {
      visitNode(child, parts);
    }
  }

  if (BLOCK_NODES.has(node.type)) {
    const last = parts[parts.length - 1];
    if (last !== undefined && !last.endsWith('\n')) {
      parts.push('\n');
    }
  }
}
