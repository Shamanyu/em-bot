import type { PersonWeeklyGoals } from '@/lib/types';
import { HealthBadge } from './HealthBadge';
import { PriorityBadge } from './PriorityBadge';

export function WeeklyGoalsWidget({ weeklyGoals }: { weeklyGoals: PersonWeeklyGoals[] }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Weekly Goals by Person</h2>

      <div className="flex flex-col gap-6">
        {weeklyGoals.map(({ person, epics }) => (
          <div key={person}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-gray-900">{person}</h3>
              <span className="text-xs text-gray-400">{epics.length} epic{epics.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex flex-col gap-3 pl-4 border-l-2 border-gray-100">
              {epics.map((epic) => (
                <div key={epic.epicKey} className={`rounded-lg border p-3 bg-white ${epic.updateMissing ? 'border-amber-200' : 'border-gray-200'}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <a
                      href={epic.epicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs font-medium text-blue-600 hover:underline"
                    >
                      {epic.epicKey}
                    </a>
                    <span className="text-sm text-gray-700">{epic.epicSummary}</span>
                    <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      <HealthBadge health={epic.scheduleHealth} />
                      <PriorityBadge priority={epic.epicPriority} />
                    </div>
                  </div>

                  {epic.epicDueDate && (
                    <p className="text-xs text-gray-400 mb-2">📅 Due {epic.epicDueDate}</p>
                  )}

                  {epic.updateMissing ? (
                    <p className="text-xs text-amber-600 font-medium">
                      ⚠ No update posted this week
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">{epic.currentStateOneLiner}</p>
                      {epic.thisWeekGoal && (
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">This week: </span>
                          {epic.thisWeekGoal}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
