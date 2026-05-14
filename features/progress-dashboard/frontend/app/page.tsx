import { readFileSync } from 'fs';
import { join } from 'path';
import type { DashboardPayload } from '@/lib/types';
import { TeamProgressWidget } from '@/components/TeamProgressWidget';
import { TeamGoalsWidget } from '@/components/TeamGoalsWidget';
import { WeeklyGoalsWidget } from '@/components/WeeklyGoalsWidget';

function loadDashboardData(): DashboardPayload {
  const filePath = join(process.cwd(), 'public', 'dashboard.json');
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as DashboardPayload;
}

export default function DashboardPage() {
  const data = loadDashboardData();

  const generatedAt = new Date(data.generatedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Engineering Progress</h1>
        <p className="text-sm text-gray-400">Updated {generatedAt} IST</p>
      </div>

      <div className="flex flex-col gap-12">
        <TeamProgressWidget data={data.teamProgress} />
        <TeamGoalsWidget goals={data.teamGoals} />
        <WeeklyGoalsWidget weeklyGoals={data.weeklyGoals} />
      </div>
    </main>
  );
}
