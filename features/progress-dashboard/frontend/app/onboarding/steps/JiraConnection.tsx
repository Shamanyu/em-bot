'use client';

import { useState } from 'react';
import type { OnboardingData } from '../page';

interface Props {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function JiraConnection({ data, onChange, onNext, onBack }: Props) {
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
      if (body.displayName) {
        onChange({ jiraDisplayName: body.displayName });
      }
    } else {
      setError(body.error ?? 'Connection failed. Check your credentials and try again.');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">JIRA Connection</h2>
      <p className="text-gray-500 text-sm mb-8">
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

        <Field label="API Token">
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {validated && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <span>✓</span>
          <span>Connected{data.jiraDisplayName ? ` as ${data.jiraDisplayName}` : ''}.</span>
        </div>
      )}

      <button
        onClick={validate}
        disabled={!canValidate || validating}
        className="w-full py-3 rounded-lg border border-indigo-300 text-indigo-700 font-medium text-sm hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
      >
        {validating ? 'Testing connection…' : 'Test Connection'}
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!validated}
          className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}
