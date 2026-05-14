'use client';

import type { OnboardingData } from '../page';

interface Props {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
];

export function ScheduleConfig({ data, onChange, onNext, onBack }: Props) {
  function toggleDay(day: number) {
    const current = data.scheduleDays;
    if (current.includes(day)) {
      onChange({ scheduleDays: current.filter((d) => d !== day) });
    } else {
      onChange({ scheduleDays: [...current, day].sort() });
    }
  }

  const utcOffset = new Date().getTimezoneOffset();
  const utcTime = computeUtcTime(data.scheduleTimeLocal, utcOffset);

  const selectedDayNames = DAYS.filter((d) => data.scheduleDays.includes(d.value))
    .map((d) => d.label)
    .join(', ');

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Schedule</h2>
      <p className="text-zinc-400 text-sm mb-8">
        When should your dashboard refresh? Defaults to weekdays at 4 PM local time.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-3">Run days</label>
        <div className="flex gap-2">
          {DAYS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => toggleDay(value)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                data.scheduleDays.includes(value)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Run time (your local time)</label>
        <input
          type="time"
          value={data.scheduleTimeLocal}
          onChange={(e) => onChange({ scheduleTimeLocal: e.target.value })}
          className="input w-36"
        />
        {utcTime && (
          <p className="text-xs text-zinc-600 mt-1">Stored as {utcTime} UTC</p>
        )}
      </div>

      {data.scheduleDays.length > 0 && data.scheduleTimeLocal && (
        <div className="mb-8 p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-300">
          Your dashboard will refresh every{' '}
          <span className="text-zinc-100 font-medium">{selectedDayNames}</span>{' '}
          at{' '}
          <span className="text-zinc-100 font-medium">{data.scheduleTimeLocal}</span> local time.
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-medium hover:bg-zinc-800 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={data.scheduleDays.length === 0 || !data.scheduleTimeLocal}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function computeUtcTime(localTime: string, offsetMinutes: number): string {
  if (!localTime) return '';
  const [h, m] = localTime.split(':').map(Number);
  if (h === undefined || m === undefined) return '';
  const totalMinutes = h * 60 + m + offsetMinutes;
  const utcH = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const utcM = ((totalMinutes % 60) + 60) % 60;
  return `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;
}
