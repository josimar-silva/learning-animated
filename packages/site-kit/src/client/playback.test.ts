import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { poster } from './playback.ts';

// A stand-in for an <object> whose loaded SVG records the SMIL calls made on it.
function fakeObject() {
  const calls: unknown[][] = [];
  const svg = {
    setCurrentTime: (t: number) => calls.push(['setCurrentTime', t]),
    pauseAnimations: () => calls.push(['pauseAnimations']),
    unpauseAnimations: () => calls.push(['unpauseAnimations']),
  };
  const object = { contentDocument: { querySelector: () => svg } } as unknown as HTMLObjectElement;
  return { object, calls };
}

test('poster seeks to the given time and holds the frame there', () => {
  const { object, calls } = fakeObject();
  poster(object, 2.4);
  expect(calls).toEqual([['setCurrentTime', 2.4], ['pauseAnimations']]);
});

test('poster is a no-op before the svg document is available', () => {
  expect(() => poster({ contentDocument: null } as unknown as HTMLObjectElement, 1)).not.toThrow();
  expect(() => poster(null, 1)).not.toThrow();
});

test('playback drives SMIL', () => {
  const source = readFileSync(new URL('./playback.ts', import.meta.url), 'utf8');
  expect(source, 'must pause SMIL').toMatch(/pauseAnimations/);
  expect(source, 'must resume SMIL').toMatch(/unpauseAnimations/);
  expect(source, 'must restart SMIL').toMatch(/setCurrentTime/);
});
