import type { ScheduleHealth } from './types.js';

export const HEALTH_LABEL: Record<ScheduleHealth, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  LIKELY_TO_SLIP: 'Likely to Slip',
  NO_DUE_DATE: 'No Due Date',
};

export const HEALTH_CLASSES: Record<ScheduleHealth, string> = {
  ON_TRACK: 'bg-green-100 text-green-800',
  AT_RISK: 'bg-yellow-100 text-yellow-800',
  LIKELY_TO_SLIP: 'bg-red-100 text-red-800',
  NO_DUE_DATE: 'bg-gray-100 text-gray-600',
};

export const PRIORITY_CLASSES: Record<string, string> = {
  Highest: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-blue-100 text-blue-800',
  Lowest: 'bg-gray-100 text-gray-600',
};
