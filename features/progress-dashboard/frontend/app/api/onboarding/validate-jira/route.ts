import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    jiraBaseUrl: string;
    jiraEmail: string;
    jiraToken: string;
  };

  const { jiraBaseUrl, jiraEmail, jiraToken } = body;

  if (!jiraBaseUrl || !jiraEmail || !jiraToken) {
    return NextResponse.json({ ok: false, error: 'Missing required fields.' }, { status: 400 });
  }

  const url = jiraBaseUrl.replace(/\/$/, '');

  try {
    const res = await fetch(`${url}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const msg = res.status === 401 || res.status === 403
        ? 'Invalid credentials. Check your email, API token, and JIRA URL.'
        : `JIRA returned ${res.status}. Check that your base URL is correct.`;
      return NextResponse.json({ ok: false, error: msg });
    }

    const data = (await res.json()) as { displayName?: string };
    return NextResponse.json({ ok: true, displayName: data.displayName ?? null });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not reach JIRA. Check that the base URL is correct.' },
      { status: 502 },
    );
  }
}
