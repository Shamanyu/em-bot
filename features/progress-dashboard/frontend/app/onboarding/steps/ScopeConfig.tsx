'use client';

import { useState, useEffect } from 'react';
import type { OnboardingData } from '../page';

interface Props {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ScopeConfig({ data, onChange, onNext, onBack }: Props) {
  const [input, setInput] = useState('');
  const [suggestedKeys, setSuggestedKeys] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      setLoadingSuggestions(true);
      try {
        const res = await fetch('/api/onboarding/jira-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jiraBaseUrl: data.jiraBaseUrl,
            jiraEmail: data.jiraEmail,
            jiraToken: data.jiraToken,
          }),
        });
        const body = (await res.json()) as { keys?: string[] };
        if (body.keys) setSuggestedKeys(body.keys);
      } catch {
        // suggestions are best-effort
      } finally {
        setLoadingSuggestions(false);
      }
    }
    void fetchProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addKey(key: string) {
    const cleaned = key.trim().toUpperCase();
    if (cleaned && !data.projectKeys.includes(cleaned)) {
      onChange({ projectKeys: [...data.projectKeys, cleaned] });
    }
    setInput('');
  }

  function removeKey(key: string) {
    onChange({ projectKeys: data.projectKeys.filter((k) => k !== key) });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKey(input);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Project Scope</h2>
      <p className="text-gray-500 text-sm mb-8">
        Choose which JIRA projects to include. Active Epics and completed stories
        are discovered automatically within these projects.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Project Keys</label>

        {loadingSuggestions && (
          <p className="text-xs text-gray-400 mb-2">Loading your projects…</p>
        )}

        {suggestedKeys.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestedKeys.map((key) => (
              <button
                key={key}
                onClick={() => addKey(key)}
                disabled={data.projectKeys.includes(key)}
                className="px-3 py-1 rounded-full border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-default border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              >
                + {key}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg min-h-[48px] bg-white">
          {data.projectKeys.map((key) => (
            <span
              key={key}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-md"
            >
              {key}
              <button onClick={() => removeKey(key)} className="hover:text-indigo-500 ml-1 font-bold">
                ×
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => input && addKey(input)}
            placeholder={data.projectKeys.length === 0 ? 'Type a key and press Enter' : ''}
            className="flex-1 min-w-[120px] outline-none text-sm text-gray-700 placeholder-gray-400"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Type a project key and press Enter or comma to add it.
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Completed issues lookback window
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={7}
            max={90}
            value={data.completedLookbackDays}
            onChange={(e) => onChange({ completedLookbackDays: Number(e.target.value) })}
            className="flex-1 accent-indigo-600"
          />
          <span className="w-20 text-sm text-gray-700 font-medium text-right">
            {data.completedLookbackDays} days
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Widget 1 (Team Progress) shows issues completed in this window.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={data.projectKeys.length === 0}
          className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
