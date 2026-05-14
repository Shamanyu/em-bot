'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JiraConnection } from './steps/JiraConnection';
import { AnthropicConnection } from './steps/AnthropicConnection';
import { ScopeConfig } from './steps/ScopeConfig';
import { ScheduleConfig } from './steps/ScheduleConfig';
import { BrandingConfig } from './steps/BrandingConfig';

export interface OnboardingData {
  // Step 1 — JIRA
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  jiraDisplayName?: string;
  // Step 2 — Anthropic
  anthropicKey: string;
  // Step 3 — Scope
  projectKeys: string[];
  completedLookbackDays: number;
  epicStatusJql: string;
  // Step 4 — Schedule
  scheduleDays: number[];
  scheduleTimeLocal: string;
  // Step 5 — Branding
  orgName: string;
  logoFile?: File;
  logoPreviewUrl: string;
  brandColor: string;
}

const STEP_LABELS = ['JIRA', 'Anthropic', 'Scope', 'Schedule', 'Branding'];

const DEFAULT_DATA: OnboardingData = {
  jiraBaseUrl: '',
  jiraEmail: '',
  jiraToken: '',
  anthropicKey: '',
  projectKeys: [],
  completedLookbackDays: 30,
  epicStatusJql: 'statusCategory = "In Progress"',
  scheduleDays: [1, 2, 3, 4, 5],
  scheduleTimeLocal: '16:00',
  orgName: '',
  logoPreviewUrl: '',
  brandColor: '#09090b',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update(updates: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append('data', JSON.stringify({
        jiraBaseUrl: data.jiraBaseUrl,
        jiraEmail: data.jiraEmail,
        jiraToken: data.jiraToken,
        anthropicKey: data.anthropicKey,
        projectKeys: data.projectKeys,
        completedLookbackDays: data.completedLookbackDays,
        scheduleDays: data.scheduleDays,
        scheduleTimeLocal: data.scheduleTimeLocal,
        orgName: data.orgName,
        brandColor: data.brandColor,
      }));
      if (data.logoFile) {
        formData.append('logo', data.logoFile);
      }

      const res = await fetch('/api/onboarding/submit', { method: 'POST', body: formData });
      const body = (await res.json()) as { ok: boolean; error?: string };

      if (!body.ok) {
        setSubmitError(body.error ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      router.push('/dashboard?onboarded=1');
    } catch {
      setSubmitError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  const totalSteps = STEP_LABELS.length;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-8 justify-center">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                    i < step
                      ? 'bg-indigo-500 text-white'
                      : i === step
                      ? 'bg-zinc-800 text-indigo-400 ring-2 ring-indigo-500'
                      : 'bg-zinc-900 text-zinc-600'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${i === step ? 'text-indigo-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
              </div>
              {i < totalSteps - 1 && (
                <div
                  className={`h-0.5 w-8 rounded-full mb-4 transition-colors ${
                    i < step ? 'bg-indigo-500' : 'bg-zinc-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {step === 0 && (
            <JiraConnection data={data} onChange={update} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <AnthropicConnection data={data} onChange={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />
          )}
          {step === 2 && (
            <ScopeConfig data={data} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <ScheduleConfig data={data} onChange={update} onNext={() => setStep(4)} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <>
              {submitError && (
                <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-xl text-sm text-red-400">
                  {submitError}
                </div>
              )}
              <BrandingConfig
                data={data}
                onChange={update}
                onNext={submit}
                onBack={() => setStep(3)}
                submitting={submitting}
              />
            </>
          )}
        </div>

      </div>
    </div>
  );
}
