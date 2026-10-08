import { describe, expect, test } from 'vitest';

import { clock } from './clock.ts';

describe('clock', () => {
  test('shows a whole second as m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(3)).toBe('0:03');
    expect(clock(75)).toBe('1:15');
  });
  test('adds the tenth when the time falls between whole seconds', () => {
    expect(clock(3.5)).toBe('0:03.5');
    expect(clock(14.5)).toBe('0:14.5');
  });
  test('rounds to tenths first, so 59.95 carries into the next minute', () =>
    expect(clock(59.95)).toBe('1:00'));
});
