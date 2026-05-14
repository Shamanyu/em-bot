'use client';

import { useState } from 'react';
import type { OnboardingData } from '../page';

interface Props {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AnthropicConnection({ data, onChange, onNext, onBack }: Props) {
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    setValidating(true);
    setError(null);
    setValidated(false);

    const res = await fetch('/api/onboarding/validate-anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropicKey: data.anthropicKey }),
    });

    const body = (await res.json()) as { ok: boolean; error?: string };
    setValidating(false);

    if (body.ok) {
      setValidated(true);
    } else {
      setError(body.error ?? 'Key validation failed. Check that it starts with "sk-ant-".');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Anthropic API Key</h2>
      <p className="text-zinc-400 text-sm mb-8">
        Used for the daily LLM analysis. Encrypted before storage — never sent to your browser after setup.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-1">API Key</label>
        <input
          type="password"
          value={data.anthropicKey}
          onChange={(e) => { onChange({ anthropicKey: e.target.value }); setValidated(false); }}
          placeholder="sk-ant-api03-…"
          className="input"
        />
        <p className="text-xs text-zinc-500 mt-1.5">
          Get yours at{' '}
          <a href="https://console.anthropic.com/keys" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
            console.anthropic.com/keys
          </a>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}
      {validated && (
        <div className="mb-4 p-3 bg-emerald-950 border border-emerald-800 rounded-xl text-sm text-emerald-400 flex items-center gap-2">
          <span>✓</span>
          <span>Key is valid.</span>
        </div>
      )}

      <button
        onClick={validate}
        disabled={!data.anthropicKey || validating}
        className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-200 font-medium text-sm hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
      >
        {validating ? 'Validating…' : 'Validate Key'}
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-medium hover:bg-zinc-800 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!validated}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
