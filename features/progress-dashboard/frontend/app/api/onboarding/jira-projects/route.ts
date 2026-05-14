import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface JiraProject {
  key: string;
  name: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    jiraBaseUrl: string;
    jiraEmail: string;
    jiraToken: string;
  };

  const { jiraBaseUrl, jiraEmail, jiraToken } = body;
  if (!jiraBaseUrl || !jiraEmail || !jiraToken) {
    return NextResponse.json({ keys: [] });
  }

  const url = jiraBaseUrl.replace(/\/$/, '');

  try {
    const res = await fetch(
      `${url}/rest/api/3/project/search?maxResults=50&orderBy=key`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`,
          Accept: 'application/json',
        },
      },
    );

    if (!res.ok) return NextResponse.json({ keys: [] });

    const data = (await res.json()) as { values?: JiraProject[] };
    const keys = (data.values ?? []).map((p) => p.key).sort();
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ keys: [] });
  }
}
