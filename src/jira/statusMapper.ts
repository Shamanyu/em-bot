import type { StatusBucket } from '../types/EpicSnapshot.js';

export function mapStatusCategory(statusCategoryKey: string): StatusBucket {
  switch (statusCategoryKey) {
    case 'new':
      return 'todo';
    case 'indeterminate':
      return 'inProgress';
    case 'done':
      return 'done';
    default:
      return 'inProgress';
  }
}
