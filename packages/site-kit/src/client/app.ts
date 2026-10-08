// Progressive enhancement for the pre-rendered pages. Every page works without
// this module; it adds playback controls and keyboard shortcuts on animation
// pages, the theme toggle, the small-screen menu, and the redirect for legacy
// #/a/<id> links. Each piece is exported so tests can drive it with a DOM.
import * as playback from './playback.ts';

const LEGACY_HASH = /^#\/a\/([a-z0-9-]+)$/;
// The map comes out of the page, so it may only send a reader to a lesson on this site.
const SITE_PATH = /^\/[a-z0-9-]+\/[a-z0-9-]+\/$/;

// Keys typed into these belong to the control, not to the shortcuts.
const CONTROLS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

export type LegacyMap = Readonly<Record<string, string>>;
export type KeyAction = 'toggle' | 'restart' | 'prev' | 'next';
export type PlaybackActions = { toggle(): void; restart(): void };

type KeyTarget = { readonly tagName?: string; readonly isContentEditable?: boolean };
export type KeyEventLike = {
  readonly key: string;
  readonly target: EventTarget | KeyTarget | null;
  readonly defaultPrevented?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
};

type WindowLike = {
  readonly location: {
    readonly hash: string;
    replace(url: string): void;
    assign(url: string): void;
  };
  readonly localStorage?: Storage | null;
};

// Where a legacy #/a/<id> link now lives, from the id-to-path map the home page embeds, or null.
export function legacyTarget(hash: string | null | undefined, map: LegacyMap): string | null {
  const id = LEGACY_HASH.exec(hash ?? '')?.[1];
  const path = id !== undefined && Object.hasOwn(map, id) ? map[id] : undefined;
  return path !== undefined && SITE_PATH.test(path) ? path : null;
}

// The shortcut a keydown asks for: 'toggle', 'restart', 'prev', 'next', or null
// when the key belongs to the browser or to the focused control.
export function keyAction(event: KeyEventLike): KeyAction | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return null;
  const { tagName, isContentEditable } = (event.target ?? {}) as KeyTarget;
  if (CONTROLS.has(tagName ?? '') || isContentEditable === true) return null;
  if (event.key === ' ') return 'toggle';
  if (event.key === 'r' || event.key === 'R') return 'restart';
  if (event.key === 'ArrowLeft') return 'prev';
  if (event.key === 'ArrowRight') return 'next';
  return null;
}

// Flips the theme on <html>, remembers the choice, and reflects it on the button.
export function wireTheme(doc: Document, storage: Pick<Storage, 'setItem'> | null): void {
  const button = doc.querySelector('[data-action="theme"]');
  if (!button) return;
  const root = doc.documentElement;
  const sync = (): void =>
    button.setAttribute('aria-pressed', String(root.classList.contains('dark')));
  sync();
  button.addEventListener('click', () => {
    const dark = root.classList.toggle('dark');
    try {
      storage?.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      // Storage can refuse writes (private browsing); the choice then lasts this page.
    }
    sync();
  });
}

// Opens and closes the small-screen navigation panel; Escape closes it.
export function wireMenu(doc: Document): void {
  const button = doc.querySelector<HTMLElement>('[data-action="menu"]');
  const id = button?.getAttribute('aria-controls');
  const nav = id ? doc.getElementById(id) : null;
  if (!button || !nav) return;
  const isOpen = (): boolean => button.getAttribute('aria-expanded') === 'true';
  const set = (open: boolean): void => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  button.addEventListener('click', () => set(!isOpen()));
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    set(false);
    button.focus();
  });
}

// Wires Pause/Play and Restart to the stage and returns those two actions, or
// null on a page without a stage. Readers who prefer less motion start paused.
export function wirePlayback(
  doc: Document,
  { reducedMotion = playback.prefersReducedMotion }: { reducedMotion?: () => boolean } = {},
): PlaybackActions | null {
  const object = doc.querySelector<HTMLObjectElement>('[data-role="stage"] object');
  if (!object) return null;
  const toggleButton = doc.querySelector('[data-action="toggle"]');
  let paused = false;
  const show = (isPaused: boolean): void => {
    paused = isPaused;
    if (!toggleButton) return;
    toggleButton.textContent = isPaused ? 'Play' : 'Pause';
    toggleButton.setAttribute('aria-pressed', String(isPaused));
  };
  const actions = {
    toggle(): void {
      if (paused) playback.play(object);
      else playback.pause(object);
      show(!paused);
    },
    restart(): void {
      playback.restart(object);
      show(false);
    },
  };
  toggleButton?.addEventListener('click', actions.toggle);
  doc.querySelector('[data-action="restart"]')?.addEventListener('click', actions.restart);
  // Dragging the scrubber pauses the animation, so the toggle must offer Play.
  doc.querySelector('[data-role="scrubber"]')?.addEventListener('input', () => show(true));

  const holdStill = (): void => {
    if (!reducedMotion()) return;
    playback.pause(object);
    show(true);
  };
  object.addEventListener('load', holdStill);
  // The svg may have loaded before this module ran.
  if (object.contentDocument?.querySelector('svg')) holdStill();
  return actions;
}

// Space toggles playback, R restarts, and the arrow keys follow the pager.
export function wireKeyboard(
  doc: Document,
  actions: PlaybackActions,
  navigate: (href: string) => void,
): void {
  doc.addEventListener('keydown', (event) => {
    const action = keyAction(event);
    if (!action) return;
    if (action === 'prev' || action === 'next') {
      const href = doc.querySelector(`a[data-role="${action}"][href]`)?.getAttribute('href');
      if (!href) return;
      event.preventDefault();
      navigate(href);
      return;
    }
    event.preventDefault();
    actions[action]();
  });
}

// Swaps the stage between before and after views.
export function wireViewToggle(doc: Document): void {
  const object = doc.querySelector<HTMLObjectElement>('[data-role="stage"] object');
  const buttons = [...doc.querySelectorAll<HTMLButtonElement>('[data-action="view"]')];
  if (!object || buttons.length === 0) return;
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const src = button.dataset.src;
      if (!src || object.getAttribute('data') === src) return;
      object.setAttribute('data', src);
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    });
  }
}

export function stepIndex(ats: readonly number[], t: number): number {
  let index = -1;
  ats.forEach((at, i) => {
    if (at <= t) index = i;
  });
  return index;
}

// Keeps the scrubber and the step list in step with the loop; both can seek.
export function wireTimeline(
  doc: Document,
  {
    schedule = (tick: () => void) => void requestAnimationFrame(tick),
  }: { schedule?: (tick: () => void) => void } = {},
): void {
  const object = doc.querySelector<HTMLObjectElement>('[data-role="stage"] object');
  const scrubber = doc.querySelector<HTMLInputElement>('[data-role="scrubber"]');
  const steps = [...doc.querySelectorAll<HTMLElement>('[data-role="step"]')];
  if (!object || (!scrubber && steps.length === 0)) return;
  const ats = steps.map((step) => Number(step.dataset.at));
  steps.forEach((step, i) =>
    step.querySelector('button')?.addEventListener('click', () => playback.seek(object, ats[i]!)),
  );
  scrubber?.addEventListener('input', () => {
    playback.pause(object);
    playback.seek(object, Number(scrubber.value));
  });
  const tick = (): void => {
    const loop = playback.loopOf(object);
    const now = playback.currentTime(object);
    if (loop !== null && now !== null) {
      const t = now % loop;
      if (scrubber && doc.activeElement !== scrubber) scrubber.value = t.toFixed(1);
      const current = stepIndex(ats, t);
      steps.forEach((step, i) =>
        i === current
          ? step.setAttribute('aria-current', 'step')
          : step.removeAttribute('aria-current'),
      );
    }
    schedule(tick);
  };
  schedule(tick);
}

function storageOf(win: WindowLike): Storage | null {
  try {
    return win.localStorage ?? null;
  } catch {
    return null;
  }
}

// The id-to-path map a book's home page embeds for its old #/a/<id> links.
function legacyMapOf(doc: Document): LegacyMap {
  const text = doc.querySelector('script[data-role="legacy-map"]')?.textContent;
  return text ? (JSON.parse(text) as LegacyMap) : {};
}

export function init(doc: Document, win: WindowLike): void {
  if (doc.body?.dataset.page === 'home') {
    const target = legacyTarget(win.location.hash, legacyMapOf(doc));
    if (target) {
      win.location.replace(target);
      return;
    }
  }
  wireTheme(doc, storageOf(win));
  wireMenu(doc);
  wireViewToggle(doc);
  wireTimeline(doc);
  const actions = wirePlayback(doc);
  if (actions) wireKeyboard(doc, actions, (href) => win.location.assign(href));
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document, window);
