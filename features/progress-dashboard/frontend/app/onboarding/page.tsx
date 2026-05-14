'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Prerequisites } from './steps/Prerequisites';
import { JiraConnection } from './steps/JiraConnection';
import { AnthropicConnection } from './steps/AnthropicConnection';
import { ScopeConfig } from './steps/ScopeConfig';
import { ScheduleConfig } from './steps/ScheduleConfig';
import { BrandingConfig } from './steps/BrandingConfig';

export interface OnboardingData {
  // Step 2 — JIRA
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  jiraDisplayName?: string;
  // Step 3 — Anthropic
  anthropicKey: string;
  // Step 4 — Scope
  projectKeys: string[];
  completedLookbackDays: number;
  // Step 5 — Schedule
  scheduleDays: number[];
  scheduleTimeLocal: string;
  // Step 6 — Branding
  orgName: string;
  logoFile?: File;
  logoPreviewUrl: string;
  brandColor: string;
}

const STEP_LABELS = [
  'Prerequisites',
  'JIRA',
  'Anthropic',
  'Scope',
  'Schedule',
  'Branding',
];

const DEFAULT_DATA: OnboardingData = {
  jiraBaseUrl: '',
  jiraEmail: '',
  jiraToken: '',
  anthropicKey: '',
  projectKeys: [],
  completedLookbackDays: 30,
  scheduleDays: [1, 2, 3, 4, 5],
  scheduleTimeLocal: '16:00',
  orgName: '',
  logoPreviewUrl: '',
  brandColor: '#ffffff',
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-8 justify-center">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  i < step
                    ? 'bg-indigo-600 text-white'
                    : i === step
                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < totalSteps - 1 && (
                <div
                  className={`h-0.5 w-6 rounded-full transition-colors ${
                    i < step ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 0 && <Prerequisites onNext={() => setStep(1)} />}
          {step === 1 && (
            <JiraConnection data={data} onChange={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />
          )}
          {step === 2 && (
            <AnthropicConnection data={data} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <ScopeConfig data={data} onChange={update} onNext={() => setStep(4)} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <ScheduleConfig data={data} onChange={update} onNext={() => setStep(5)} onBack={() => setStep(3)} />
          )}
          {step === 5 && (
            <>
              {submitError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <BrandingConfig
                data={data}
                onChange={update}
                onNext={submit}
                onBack={() => setStep(4)}
                submitting={submitting}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
