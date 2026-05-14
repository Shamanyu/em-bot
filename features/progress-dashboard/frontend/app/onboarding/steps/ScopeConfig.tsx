'use client';

import { useState, useEffect } from 'react';
import type { OnboardingData } from '../page';

interface Props {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const STATUS_PRESETS = [
  { label: 'In Progress only', value: 'statusCategory = "In Progress"', description: 'Only Epics actively being worked on' },
  { label: 'All active (not Done)', value: 'statusCategory != Done', description: 'Includes To Do + In Progress Epics' },
];

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
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Project Scope</h2>
      <p className="text-zinc-400 text-sm mb-8">
        Choose which JIRA projects to track. Epics and completed stories are discovered automatically.
      </p>

      {/* Project keys */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-2">Project Keys</label>

        {loadingSuggestions && (
          <p className="text-xs text-zinc-500 mb-2">Loading your projects…</p>
        )}
        {suggestedKeys.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestedKeys.map((key) => (
              <button
                key={key}
                onClick={() => addKey(key)}
                disabled={data.projectKeys.includes(key)}
                className="px-3 py-1 rounded-full border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                + {key}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 p-3 border border-zinc-700 rounded-xl min-h-[48px] bg-zinc-800">
          {data.projectKeys.map((key) => (
            <span key={key} className="flex items-center gap-1 px-2 py-1 bg-indigo-900 text-indigo-300 text-xs font-medium rounded-lg">
              {key}
              <button onClick={() => removeKey(key)} className="hover:text-indigo-100 ml-0.5 font-bold">×</button>
            </span>
          ))}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => input && addKey(input)}
            placeholder={data.projectKeys.length === 0 ? 'Type a key and press Enter' : ''}
            className="flex-1 min-w-[120px] outline-none text-sm text-zinc-200 placeholder-zinc-600 bg-transparent"
          />
        </div>
        <p className="text-xs text-zinc-600 mt-1">Type a project key and press Enter or comma to add.</p>
      </div>

      {/* Epic status */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-2">Which Epics to analyse</label>
        <div className="space-y-2">
          {STATUS_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onChange({ epicStatusJql: preset.value })}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                data.epicStatusJql === preset.value
                  ? 'border-indigo-500 bg-indigo-950'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
            >
              <span className={`w-4 h-4 mt-0.5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                data.epicStatusJql === preset.value ? 'border-indigo-400' : 'border-zinc-600'
              }`}>
                {data.epicStatusJql === preset.value && (
                  <span className="w-2 h-2 rounded-full bg-indigo-400 block" />
                )}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-200">{preset.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lookback window */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-zinc-300">Completed issues lookback</label>
          <span className="text-sm font-semibold text-indigo-400">{data.completedLookbackDays} days</span>
        </div>
        <input
          type="range"
          min={7}
          max={90}
          value={data.completedLookbackDays}
          onChange={(e) => onChange({ completedLookbackDays: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
        <p className="text-xs text-zinc-600 mt-1">
          The &quot;What shipped&quot; widget shows issues completed in this window.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-medium hover:bg-zinc-800 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={data.projectKeys.length === 0}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
