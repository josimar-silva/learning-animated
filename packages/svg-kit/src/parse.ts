import { DOMParser } from 'linkedom';

export type ParsedSvg = { readonly text: string; readonly svg: Element };

export function parseSvg(text: string): ParsedSvg {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  return { text, svg: doc.documentElement as unknown as Element };
}

export function tagOf(el: Element): string {
  return (el.localName || el.tagName || '').toLowerCase();
}
