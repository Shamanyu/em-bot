import type { ScheduleHealth } from '@/lib/types';
import { HEALTH_CLASSES, HEALTH_LABEL } from '@/lib/constants';

export function HealthBadge({ health }: { health: ScheduleHealth }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_CLASSES[health]}`}>
      {HEALTH_LABEL[health]}
    </span>
  );
}
