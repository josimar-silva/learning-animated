// SMIL playback controls for an embedded animation. Reaching into an <object>'s
// document is same-origin only, so the site must be served over http(s); file://
// will not expose contentDocument.

function svgOf(object: HTMLObjectElement | null): SVGSVGElement | null {
  return object?.contentDocument?.querySelector('svg') ?? null;
}

export function pause(object: HTMLObjectElement | null): void {
  const svg = svgOf(object);
  if (svg && typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
}

export function play(object: HTMLObjectElement | null): void {
  const svg = svgOf(object);
  if (svg && typeof svg.unpauseAnimations === 'function') svg.unpauseAnimations();
}

export function restart(object: HTMLObjectElement | null): void {
  const svg = svgOf(object);
  if (!svg) return;
  if (typeof svg.setCurrentTime === 'function') svg.setCurrentTime(0);
  if (typeof svg.unpauseAnimations === 'function') svg.unpauseAnimations();
}

// Seek to a moment and hold it there: a still frame of the animation.
export function poster(object: HTMLObjectElement | null, seconds: number): void {
  const svg = svgOf(object);
  if (!svg) return;
  if (typeof svg.setCurrentTime === 'function') svg.setCurrentTime(seconds);
  if (typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
}

// Respect the reader's motion preference: paused by default when they ask for less.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function seek(object: HTMLObjectElement | null, seconds: number): void {
  const svg = svgOf(object);
  if (svg && typeof svg.setCurrentTime === 'function') svg.setCurrentTime(seconds);
}

export function currentTime(object: HTMLObjectElement | null): number | null {
  const svg = svgOf(object);
  return svg && typeof svg.getCurrentTime === 'function' ? svg.getCurrentTime() : null;
}

// The loop an SVG declares with data-loop, in seconds, or null when it runs free.
export function loopOf(object: HTMLObjectElement | null): number | null {
  const raw = svgOf(object)?.getAttribute('data-loop');
  return raw ? Number(raw.replace(/s$/, '')) : null;
}
