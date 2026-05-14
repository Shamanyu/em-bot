import { describe, it, expect } from 'vitest';
import { mapStatusCategory } from '../../src/jira/statusMapper.js';

describe('mapStatusCategory', () => {
  it('maps "new" to "todo"', () => {
    expect(mapStatusCategory('new')).toBe('todo');
  });

  it('maps "indeterminate" to "inProgress"', () => {
    expect(mapStatusCategory('indeterminate')).toBe('inProgress');
  });

  it('maps "done" to "done"', () => {
    expect(mapStatusCategory('done')).toBe('done');
  });

  it('maps unknown value to "inProgress"', () => {
    expect(mapStatusCategory('undefined')).toBe('inProgress');
    expect(mapStatusCategory('')).toBe('inProgress');
    expect(mapStatusCategory('CUSTOM')).toBe('inProgress');
  });
});
