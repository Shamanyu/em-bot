import { createClient } from '@/lib/supabase/server';
import { TeamProgressWidget } from '@/components/TeamProgressWidget';
import { TeamGoalsWidget } from '@/components/TeamGoalsWidget';
import { WeeklyGoalsWidget } from '@/components/WeeklyGoalsWidget';
import type { DashboardPayload } from '@/lib/types';
import type { Json } from '@/lib/supabase/types';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarded?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // middleware handles redirect

  const { data: dashRow } = await supabase
    .from('dashboard_data')
    .select('payload, generated_at, run_status, error_msg')
    .eq('tenant_id', user.id)
    .single();

  const isPending =
    !dashRow ||
    dashRow.run_status === 'pending' ||
    dashRow.run_status === 'running' ||
    !dashRow.payload ||
    isEmptyPayload(dashRow.payload);

  const { data: config } = await supabase
    .from('tenant_config')
    .select('next_run_at, page_title')
    .eq('tenant_id', user.id)
    .single();

  if (isPending) {
    return <PendingState nextRunAt={config?.next_run_at ?? null} justOnboarded={params.onboarded === '1'} />;
  }

  const data = dashRow.payload as unknown as DashboardPayload;

  const generatedAt = new Date(dashRow.generated_at).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {config?.page_title ?? 'Engineering Progress'}
        </h1>
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

function PendingState({
  nextRunAt,
  justOnboarded,
}: {
  nextRunAt: string | null;
  justOnboarded: boolean;
}) {
  const nextRun = nextRunAt
    ? new Date(nextRunAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 mb-6">
        <span className="text-3xl">⏳</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        {justOnboarded ? 'You\'re all set!' : 'Data refresh in progress'}
      </h1>
      <p className="text-gray-500 max-w-md mx-auto mb-4">
        {justOnboarded
          ? 'Your dashboard is configured and your first data refresh has been scheduled.'
          : 'Your dashboard data is being generated.'}
        {nextRun && ` It will be ready by ${nextRun} IST.`}
      </p>
      <p className="text-xs text-gray-400">
        Refresh this page after your first scheduled run completes.
      </p>
    </main>
  );
}

function isEmptyPayload(payload: Json): boolean {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return true;
  return Object.keys(payload).length === 0;
}
