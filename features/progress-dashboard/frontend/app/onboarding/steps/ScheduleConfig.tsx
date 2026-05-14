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

  const selectedDayNames = DAYS.filter((d) => data.scheduleDays.includes(d.value))
    .map((d) => d.label)
    .join(', ');

  const utcOffset = new Date().getTimezoneOffset();
  const utcHour = computeUtcTime(data.scheduleTimeLocal, utcOffset);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Schedule</h2>
      <p className="text-gray-500 text-sm mb-8">
        Choose when your dashboard should refresh. All times are in your local timezone.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Run days</label>
        <div className="flex gap-2">
          {DAYS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => toggleDay(value)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                data.scheduleDays.includes(value)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Run time (local time)
        </label>
        <input
          type="time"
          value={data.scheduleTimeLocal}
          onChange={(e) => onChange({ scheduleTimeLocal: e.target.value })}
          className="input w-40"
        />
        {utcHour && (
          <p className="text-xs text-gray-400 mt-1">
            Stores as {utcHour} UTC
          </p>
        )}
      </div>

      {data.scheduleDays.length > 0 && (
        <div className="mb-6 p-4 bg-indigo-50 rounded-xl text-sm text-indigo-800">
          Your dashboard will update every{' '}
          <strong>{selectedDayNames}</strong> at{' '}
          <strong>{data.scheduleTimeLocal}</strong> local time.
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={data.scheduleDays.length === 0 || !data.scheduleTimeLocal}
          className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
