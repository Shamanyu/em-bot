import type { EpicGoal } from '@/lib/types';
import { HealthBadge } from './HealthBadge';
import { PriorityBadge } from './PriorityBadge';
import { ProgressBar } from './ProgressBar';

export function TeamGoalsWidget({ goals }: { goals: EpicGoal[] }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Goals</h2>

      <div className="flex flex-col gap-4">
        {goals.map((epic) => (
          <div key={epic.epicKey} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <a
                href={epic.epicUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm font-medium text-blue-600 hover:underline"
              >
                {epic.epicKey}
              </a>
              <span className="text-sm font-medium text-gray-800">{epic.epicSummary}</span>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <HealthBadge health={epic.scheduleHealth} />
                <PriorityBadge priority={epic.epicPriority} />
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
              {epic.epicAssignee && <span>👤 {epic.epicAssignee}</span>}
              {epic.epicDueDate && <span>📅 Due {epic.epicDueDate}</span>}
            </div>

            <p className="text-sm text-gray-700 font-medium mb-1">{epic.oneLineSummary}</p>
            <p className="text-sm text-gray-600 mb-3">{epic.currentStatus}</p>

            <ProgressBar percent={epic.percentComplete} />

            {epic.blockers.length > 0 && (
              <div className="mt-3 rounded-md bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Blockers</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {epic.blockers.map((b, i) => (
                    <li key={i} className="text-xs text-red-600">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
