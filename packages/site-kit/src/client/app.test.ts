import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseHTML } from 'linkedom';
import { describe, expect, test } from 'vitest';

import {
  init,
  keyAction,
  legacyTarget,
  stepIndex,
  wireKeyboard,
  wireMenu,
  wirePlayback,
  wireTheme,
  wireTimeline,
  wireViewToggle,
} from './app.ts';
import { currentTime, loopOf, seek } from './playback.ts';

const LEGACY_MAP = {
  'consumer-group': '/ch01-meet-kafka/consumer-group/',
  acks: '/ch03-kafka-producers/acks/',
};

const HEADER = `<header>
  <nav id="site-nav" aria-label="Main"><a href="/">Contents</a><a href="/about/">About</a></nav>
  <button type="button" data-action="theme" aria-pressed="false" aria-label="Dark theme"></button>
  <button type="button" data-action="menu" aria-controls="site-nav" aria-expanded="false" aria-label="Menu"></button>
</header>`;

// Stand-ins for the rendered pages, with the hooks the site-kit components render.
function renderHome(): string {
  return `<body data-page="home">${HEADER}<main>
    <script type="application/json" data-role="legacy-map">${JSON.stringify(LEGACY_MAP)}</script>
  </main></body>`;
}

function renderAnimation({
  prev,
  next,
  scrubber = false,
}: { prev?: string; next?: string; scrubber?: boolean } = {}): string {
  return `<body data-page="animation">${HEADER}<main>
    <div data-role="stage"><object type="image/svg+xml" data="/embed/topic-partitions.svg"></object></div>
    <button type="button" data-action="toggle" aria-pressed="false">Pause</button>
    <button type="button" data-action="restart">Restart</button>
    ${scrubber ? '<input type="range" data-role="scrubber" min="0" max="10" step="0.1" value="0">' : ''}
    <nav aria-label="Animations">${prev ? `<a data-role="prev" rel="prev" href="${prev}">Previous</a>` : '<span></span>'}${next ? `<a data-role="next" rel="next" href="${next}">Next</a>` : ''}</nav>
  </main></body>`;
}

// A page parsed into a DOM for the app to enhance.
function pageDom(body: string) {
  const { document, Event } = parseHTML(
    `<!doctype html><html lang="en"><head></head>${body}</html>`,
  );
  const fire = (el: EventTarget, type: string) =>
    el.dispatchEvent(new Event(type) as unknown as globalThis.Event);
  const click = (el: EventTarget) => fire(el, 'click');
  const keydown = (el: EventTarget, key: string) => {
    const event = Object.assign(new Event('keydown', { bubbles: true, cancelable: true }), {
      key,
    }) as unknown as KeyboardEvent;
    el.dispatchEvent(event);
    return event;
  };
  return { doc: document as unknown as Document, fire, click, keydown };
}

// Gives an <object> a loaded svg that records the SMIL calls made on it.
function loadSvg(object: Element | null): string[] {
  const calls: string[] = [];
  const svg = {
    pauseAnimations: () => calls.push('pause'),
    unpauseAnimations: () => calls.push('unpause'),
    setCurrentTime: (t: number) => calls.push(`seek ${t}`),
  };
  Object.defineProperty(object, 'contentDocument', {
    configurable: true,
    value: { querySelector: () => svg },
  });
  return calls;
}

function fakeWindow(hash = '') {
  const replaced: string[] = [];
  const assigned: string[] = [];
  const location = {
    hash,
    replace: (url: string) => replaced.push(url),
    assign: (url: string) => assigned.push(url),
  };
  return { win: { location, localStorage: null }, replaced, assigned };
}

const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8');

test('legacy hash links map to the new animation pages', () => {
  expect(legacyTarget('#/a/consumer-group', LEGACY_MAP)).toBe('/ch01-meet-kafka/consumer-group/');
  expect(legacyTarget('#/a/acks', { acks: '/ch03-kafka-producers/acks/' })).toBe(
    '/ch03-kafka-producers/acks/',
  );
  for (const hash of [
    '',
    '#',
    '#/',
    '#/a/',
    '#/a/does-not-exist',
    '#/a/Bad',
    '#/a/x/y',
    '#/a/constructor',
  ]) {
    expect(legacyTarget(hash, LEGACY_MAP), `"${hash}" has no target`).toBeNull();
  }
  expect(legacyTarget(undefined, LEGACY_MAP)).toBeNull();
});

test('keyAction maps the shortcuts and leaves everything else to the browser', () => {
  const body = { tagName: 'BODY' };
  expect(keyAction({ key: ' ', target: body })).toBe('toggle');
  expect(keyAction({ key: 'r', target: body })).toBe('restart');
  expect(keyAction({ key: 'R', target: body })).toBe('restart');
  expect(keyAction({ key: 'ArrowLeft', target: body })).toBe('prev');
  expect(keyAction({ key: 'ArrowRight', target: body })).toBe('next');
  expect(keyAction({ key: 'x', target: body })).toBeNull();
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
    expect(keyAction({ key: 'r', target: body, [modifier]: true }), modifier).toBeNull();
  }
  expect(keyAction({ key: ' ', target: body, defaultPrevented: true })).toBeNull();
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']) {
    expect(keyAction({ key: ' ', target: { tagName } }), tagName).toBeNull();
  }
  expect(keyAction({ key: ' ', target: { tagName: 'DIV', isContentEditable: true } })).toBeNull();
});

test('the theme toggle flips dark mode, remembers it, and reports it', () => {
  const { doc, click } = pageDom(renderHome());
  const stored = new Map<string, string>();
  wireTheme(doc, { setItem: (k, v) => stored.set(k, v) });
  const button = doc.querySelector('[data-action="theme"]')!;
  expect(button.getAttribute('aria-pressed')).toBe('false');

  click(button);
  expect(doc.documentElement.classList.contains('dark')).toBe(true);
  expect(stored.get('theme')).toBe('dark');
  expect(button.getAttribute('aria-pressed')).toBe('true');

  click(button);
  expect(doc.documentElement.classList.contains('dark')).toBe(false);
  expect(stored.get('theme')).toBe('light');
  expect(button.getAttribute('aria-pressed')).toBe('false');
});

test('the theme toggle reflects a theme the boot script already applied', () => {
  const { doc } = pageDom(renderHome());
  doc.documentElement.classList.add('dark');
  wireTheme(doc, null);
  expect(doc.querySelector('[data-action="theme"]')?.getAttribute('aria-pressed')).toBe('true');
});

test('the theme toggle still works when storage refuses writes', () => {
  const { doc, click } = pageDom(renderHome());
  wireTheme(doc, {
    setItem: () => {
      throw new Error('denied');
    },
  });
  click(doc.querySelector('[data-action="theme"]')!);
  expect(doc.documentElement.classList.contains('dark')).toBe(true);
});

test('the menu button opens the navigation panel and Escape closes it', () => {
  const { doc, click, keydown } = pageDom(renderHome());
  wireMenu(doc);
  const button = doc.querySelector('[data-action="menu"]')!;
  const nav = doc.getElementById('site-nav')!;

  click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(nav.classList.contains('is-open')).toBe(true);
  click(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(nav.classList.contains('is-open')).toBe(false);

  click(button);
  keydown(doc.body, 'Escape');
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(nav.classList.contains('is-open')).toBe(false);
});

test('pause, play, and restart drive the SMIL timeline and relabel the toggle', () => {
  const { doc, click } = pageDom(renderAnimation());
  const calls = loadSvg(doc.querySelector('[data-role="stage"] object'));
  wirePlayback(doc, { reducedMotion: () => false });
  const toggle = doc.querySelector('[data-action="toggle"]')!;

  click(toggle);
  expect(calls).toEqual(['pause']);
  expect(toggle.textContent).toBe('Play');
  expect(toggle.getAttribute('aria-pressed')).toBe('true');

  click(toggle);
  expect(calls).toEqual(['pause', 'unpause']);
  expect(toggle.textContent).toBe('Pause');
  expect(toggle.getAttribute('aria-pressed')).toBe('false');

  click(toggle);
  click(doc.querySelector('[data-action="restart"]')!);
  expect(calls.slice(-3)).toEqual(['pause', 'seek 0', 'unpause']);
  expect(toggle.textContent).toBe('Pause');
});

test('readers who prefer less motion start paused once the svg loads', () => {
  const { doc, fire } = pageDom(renderAnimation());
  const object = doc.querySelector('[data-role="stage"] object')!;
  wirePlayback(doc, { reducedMotion: () => true });
  const calls = loadSvg(object);
  fire(object, 'load');
  expect(calls).toEqual(['pause']);
  expect(doc.querySelector('[data-action="toggle"]')?.textContent).toBe('Play');
});

test('an svg that loaded before the app ran is held still too', () => {
  const { doc } = pageDom(renderAnimation());
  const calls = loadSvg(doc.querySelector('[data-role="stage"] object'));
  wirePlayback(doc, { reducedMotion: () => true });
  expect(calls).toEqual(['pause']);
});

test('pages without a stage get no playback', () => {
  const { doc } = pageDom(renderHome());
  expect(wirePlayback(doc)).toBeNull();
});

test('the toggle offers Play once the scrubber pauses the animation', () => {
  const { doc, fire } = pageDom(renderAnimation({ scrubber: true }));
  wirePlayback(doc, { reducedMotion: () => false });
  fire(doc.querySelector('[data-role="scrubber"]')!, 'input');
  const toggle = doc.querySelector('[data-action="toggle"]');
  expect(toggle?.textContent).toBe('Play');
  expect(toggle?.getAttribute('aria-pressed')).toBe('true');
});

test('keyboard shortcuts toggle, restart, and follow the pager', () => {
  const { doc, keydown } = pageDom(
    renderAnimation({
      prev: '/ch01-meet-kafka/topic-partitions/',
      next: '/ch01-meet-kafka/consumer-group/',
    }),
  );
  const done: string[] = [];
  const visited: string[] = [];
  const actions = { toggle: () => done.push('toggle'), restart: () => done.push('restart') };
  wireKeyboard(doc, actions, (href) => visited.push(href));

  const space = keydown(doc.body, ' ');
  keydown(doc.body, 'r');
  keydown(doc.body, 'ArrowRight');
  keydown(doc.body, 'ArrowLeft');
  expect(done).toEqual(['toggle', 'restart']);
  expect(space.defaultPrevented, 'space does not also scroll the page').toBe(true);
  expect(visited).toEqual([
    '/ch01-meet-kafka/consumer-group/',
    '/ch01-meet-kafka/topic-partitions/',
  ]);

  keydown(doc.querySelector('[data-action="restart"]')!, ' ');
  expect(done, 'keys on a button belong to the button').toEqual(['toggle', 'restart']);
});

test('the arrow keys stop at the ends of the trail', () => {
  const { doc, keydown } = pageDom(renderAnimation({ next: '/ch01-meet-kafka/consumer-group/' }));
  const visited: string[] = [];
  wireKeyboard(doc, { toggle() {}, restart() {} }, (href) => visited.push(href));
  const left = keydown(doc.body, 'ArrowLeft');
  expect(visited).toEqual([]);
  expect(left.defaultPrevented, 'the browser keeps the key').toBe(false);
});

test('the home page redirects a legacy hash link to its new page', () => {
  const { doc } = pageDom(renderHome());
  const { win, replaced } = fakeWindow('#/a/consumer-group');
  init(doc, win);
  expect(replaced).toEqual(['/ch01-meet-kafka/consumer-group/']);
});

test('init ignores an unknown hash and enhances the page', () => {
  const { doc, click } = pageDom(renderHome());
  const { win, replaced } = fakeWindow('#/a/does-not-exist');
  init(doc, win);
  expect(replaced).toEqual([]);
  click(doc.querySelector('[data-action="menu"]')!);
  expect(doc.querySelector('[data-action="menu"]')?.getAttribute('aria-expanded')).toBe('true');
});

test('only the home page honours legacy hash links', () => {
  const { doc, keydown } = pageDom(renderAnimation({ next: '/ch01-meet-kafka/consumer-group/' }));
  const { win, replaced, assigned } = fakeWindow('#/a/consumer-group');
  init(doc, win);
  expect(replaced).toEqual([]);
  keydown(doc.body, 'ArrowRight');
  expect(assigned).toEqual(['/ch01-meet-kafka/consumer-group/']);
});

test('the app enhances pages with playback and reads the rest from the page', () => {
  const imports = [...source('./app.ts').matchAll(/from '([^']+)'/g)].map(([, spec]) => spec);
  expect(imports).toEqual(['./playback.ts']);
});

// The browser loads these modules, so none may import a Node built-in or a bare package name.
test('every module the browser loads is a relative, browser-safe module', () => {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(
      /(?:from|import)\s+['"]([^'"]+)['"]/g,
    )) {
      expect(spec!.startsWith('.'), `${file} imports "${spec}", which a browser cannot load`).toBe(
        true,
      );
      visit(resolve(dirname(file), spec!));
    }
  };
  visit(fileURLToPath(new URL('./app.ts', import.meta.url)));
  expect(
    seen.has(fileURLToPath(new URL('./playback.ts', import.meta.url))),
    'the app reaches playback.ts',
  ).toBe(true);
});

type FakeSvg = { time: number; paused: boolean; seeks: number[] };

function stage(extra = '', loop: string | null = '10s') {
  const { document, Event } = parseHTML(`<html><body>
    <div data-role="stage"><object data="/embed/x.before.svg"></object></div>${extra}</body></html>`);
  const state: FakeSvg = { time: 0, paused: false, seeks: [] };
  const svg = {
    getAttribute: (name: string) => (name === 'data-loop' ? loop : null),
    getCurrentTime: () => state.time,
    setCurrentTime: (t: number) => {
      state.seeks.push(t);
      state.time = t;
    },
    pauseAnimations: () => {
      state.paused = true;
    },
    unpauseAnimations: () => {
      state.paused = false;
    },
  };
  const object = document.querySelector('object')!;
  Object.defineProperty(object, 'contentDocument', { value: { querySelector: () => svg } });
  const fire = (el: Element, type: string) =>
    el.dispatchEvent(new Event(type) as unknown as globalThis.Event);
  return {
    document: document as unknown as Document,
    object: object as unknown as HTMLObjectElement,
    state,
    fire,
  };
}

describe('playback additions', () => {
  test('seek, currentTime, and loopOf reach through the object', () => {
    const { object, state } = stage();
    seek(object, 4.5);
    expect(state.seeks).toEqual([4.5]);
    expect(currentTime(object)).toBe(4.5);
    expect(loopOf(object)).toBe(10);
  });
  test('a free-running SVG has no loop', () => expect(loopOf(stage('', null).object)).toBeNull());
});

describe('wireViewToggle', () => {
  test('swaps the stage to the picked view and marks the pressed button', () => {
    const { document, object, fire } = stage(`
      <button data-action="view" data-src="/embed/x.before.svg" aria-pressed="true">Before</button>
      <button data-action="view" data-src="/embed/x.after.svg" aria-pressed="false">After</button>`);
    wireViewToggle(document);
    const [before, after] = document.querySelectorAll('[data-action="view"]');
    fire(after!, 'click');
    expect(object.getAttribute('data')).toBe('/embed/x.after.svg');
    expect(before!.getAttribute('aria-pressed')).toBe('false');
    expect(after!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('wireTimeline', () => {
  const steps = `<input type="range" data-role="scrubber" min="0" max="10" step="0.1" value="0">
    <ol><li data-role="step" data-at="0"><button>0:00</button></li>
    <li data-role="step" data-at="3"><button>0:03</button></li>
    <li data-role="step" data-at="6"><button>0:06</button></li></ol>`;
  test('stepIndex finds the last step at or before a moment', () => {
    expect(stepIndex([0, 3, 6], 0)).toBe(0);
    expect(stepIndex([0, 3, 6], 5.9)).toBe(1);
    expect(stepIndex([2, 3], 1)).toBe(-1);
  });
  test('marks the current step and moves the scrubber', () => {
    const { document, state } = stage(steps);
    state.time = 14.2; // second loop, 4.2 s in
    const ticks: Array<() => void> = [];
    wireTimeline(document, {
      schedule: (tick) => {
        ticks.push(tick);
      },
    });
    ticks.shift()!();
    const marked = [...document.querySelectorAll('[data-role="step"]')].map((s) =>
      s.getAttribute('aria-current'),
    );
    expect(marked).toEqual([null, 'step', null]);
    expect((document.querySelector('[data-role="scrubber"]') as HTMLInputElement).value).toBe(
      '4.2',
    );
  });
  test('picking a step seeks to it', () => {
    const { document, state, fire } = stage(steps);
    wireTimeline(document, { schedule: () => {} });
    fire(document.querySelectorAll('[data-role="step"] button')[2]!, 'click');
    expect(state.seeks).toEqual([6]);
  });
  test('dragging the scrubber pauses and seeks', () => {
    const { document, state, fire } = stage(steps);
    wireTimeline(document, { schedule: () => {} });
    const scrubber = document.querySelector('[data-role="scrubber"]') as HTMLInputElement;
    scrubber.value = '7.5';
    fire(scrubber, 'input');
    expect(state.paused).toBe(true);
    expect(state.seeks).toEqual([7.5]);
  });
});
