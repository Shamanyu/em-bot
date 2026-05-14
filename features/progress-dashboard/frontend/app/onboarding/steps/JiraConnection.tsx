'use client';

import { useState } from 'react';
import type { OnboardingData } from '../page';

interface Props {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function JiraConnection({ data, onChange, onNext }: Props) {
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canValidate = data.jiraBaseUrl && data.jiraEmail && data.jiraToken;

  async function validate() {
    setValidating(true);
    setError(null);
    setValidated(false);

    const res = await fetch('/api/onboarding/validate-jira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jiraBaseUrl: data.jiraBaseUrl,
        jiraEmail: data.jiraEmail,
        jiraToken: data.jiraToken,
      }),
    });

    const body = (await res.json()) as { ok: boolean; displayName?: string; error?: string };
    setValidating(false);

    if (body.ok) {
      setValidated(true);
      if (body.displayName) onChange({ jiraDisplayName: body.displayName });
    } else {
      setError(body.error ?? 'Connection failed. Check your credentials and try again.');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">JIRA Connection</h2>
      <p className="text-zinc-400 text-sm mb-8">
        Enter your JIRA credentials. We&apos;ll verify they work before continuing.
      </p>

      <div className="space-y-4 mb-6">
        <Field label="JIRA Base URL" hint="e.g. https://acme.atlassian.net">
          <input
            type="url"
            value={data.jiraBaseUrl}
            onChange={(e) => { onChange({ jiraBaseUrl: e.target.value }); setValidated(false); }}
            placeholder="https://your-org.atlassian.net"
            className="input"
          />
        </Field>
        <Field label="Atlassian Email">
          <input
            type="email"
            value={data.jiraEmail}
            onChange={(e) => { onChange({ jiraEmail: e.target.value }); setValidated(false); }}
            placeholder="you@company.com"
            className="input"
          />
        </Field>
        <Field label="API Token" hint={<>Create one at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">id.atlassian.com → Security → API tokens</a></>}>
          <input
            type="password"
            value={data.jiraToken}
            onChange={(e) => { onChange({ jiraToken: e.target.value }); setValidated(false); }}
            placeholder="Paste your JIRA API token"
            className="input"
          />
        </Field>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}
      {validated && (
        <div className="mb-4 p-3 bg-emerald-950 border border-emerald-800 rounded-xl text-sm text-emerald-400 flex items-center gap-2">
          <span>✓</span>
          <span>Connected{data.jiraDisplayName ? ` as ${data.jiraDisplayName}` : ''}.</span>
        </div>
      )}

      <button
        onClick={validate}
        disabled={!canValidate || validating}
        className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-200 font-medium text-sm hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
      >
        {validating ? 'Testing connection…' : 'Test Connection'}
      </button>

      <button
        onClick={onNext}
        disabled={!validated}
        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue →
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-zinc-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
