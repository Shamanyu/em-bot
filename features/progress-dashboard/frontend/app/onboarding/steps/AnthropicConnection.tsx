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
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Anthropic API Key</h2>
      <p className="text-gray-500 text-sm mb-8">
        This key is used to run the daily LLM analysis. It is encrypted before storage
        and never sent to your browser after onboarding completes.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            value={data.anthropicKey}
            onChange={(e) => { onChange({ anthropicKey: e.target.value }); setValidated(false); }}
            placeholder="sk-ant-api03-…"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            Find yours at{' '}
            <a
              href="https://console.anthropic.com/keys"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              console.anthropic.com/keys
            </a>
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {validated && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <span>✓</span>
          <span>Key is valid.</span>
        </div>
      )}

      <button
        onClick={validate}
        disabled={!data.anthropicKey || validating}
        className="w-full py-3 rounded-lg border border-indigo-300 text-indigo-700 font-medium text-sm hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
      >
        {validating ? 'Validating…' : 'Validate Key'}
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
