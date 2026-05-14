import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { anthropicKey: string };
  const { anthropicKey } = body;

  if (!anthropicKey) {
    return NextResponse.json({ ok: false, error: 'API key is required.' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: 'Invalid API key.' });
    }

    if (!res.ok && res.status !== 400) {
      return NextResponse.json(
        { ok: false, error: `Anthropic returned ${res.status}.` },
      );
    }

    // 200 or 400 (e.g. max_tokens=1 triggers a stop-reason error but key is valid)
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not reach Anthropic API.' },
      { status: 502 },
    );
  }
}
