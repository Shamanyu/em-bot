import type { TeamProgress } from '@/lib/types';

export function TeamProgressWidget({ data }: { data: TeamProgress }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">What We Shipped</h2>
        <span className="text-sm text-gray-500">
          {data.periodStart} – {data.periodEnd}
        </span>
      </div>

      <p className="text-gray-700 mb-6">{data.headline}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.themes.map((theme) => (
          <div key={theme.name} className="rounded-lg border border-gray-200 p-4 bg-white">
            <h3 className="font-medium text-gray-900 mb-1">{theme.name}</h3>
            <p className="text-sm text-gray-600 mb-3">{theme.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {theme.issueKeys.map((key) => (
                <span
                  key={key}
                  className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600"
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
