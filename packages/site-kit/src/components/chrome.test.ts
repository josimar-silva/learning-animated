import { describe, expect, test } from 'vitest';

import { dom } from '../../test/dom.ts';
import { render } from '../../test/render.ts';
import { defineTrack } from '../schemas.ts';
import { THEME_BOOT } from '../theme-boot.ts';
import Breadcrumb from './Breadcrumb.astro';
import Footer from './Footer.astro';
import Header from './Header.astro';
import Layout from './Layout.astro';

const SITE = {
  url: 'https://quarkus.learning-animated.com/',
  name: 'Quarkus Animated',
  shortName: 'Quarkus Animated',
  tagline: 'T',
  repoUrl: 'https://github.com/josimar-silva/learning-animated',
};
const LAUNCHED = defineTrack({ id: 'quarkus', kind: 'curriculum', launched: true, site: SITE });
const PAGE = {
  track: LAUNCHED,
  kind: 'section',
  path: '/rest/',
  title: 'REST | Quarkus Animated',
  description: 'D',
};
const attr = (doc: Document, selector: string, name: string) =>
  doc.querySelector(selector)?.getAttribute(name);

describe('Layout', () => {
  test('carries the title, canonical link, and social tags', async () => {
    const doc = dom(await render(Layout, PAGE));
    expect(doc.querySelector('title')?.textContent?.trim()).toBe('REST | Quarkus Animated');
    expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe(
      'https://quarkus.learning-animated.com/rest/',
    );
    expect(attr(doc, 'meta[name="robots"]', 'content')).toBe('index,follow');
    expect(attr(doc, 'meta[property="og:type"]', 'content')).toBe('article');
    expect(attr(doc, 'meta[property="og:image"]', 'content')).toBe(
      'https://quarkus.learning-animated.com/og.png',
    );
    expect(attr(doc, 'body', 'data-page')).toBe('section');
  });
  test('an unlaunched site and the not-found page are not indexed', async () => {
    const unlaunched = dom(
      await render(Layout, { ...PAGE, track: { ...LAUNCHED, launched: false } }),
    );
    expect(attr(unlaunched, 'meta[name="robots"]', 'content')).toBe('noindex');
    expect(unlaunched.querySelector('link[rel="canonical"]')).toBeNull();
    const missing = dom(await render(Layout, { ...PAGE, kind: 'not-found' }));
    expect(attr(missing, 'meta[name="robots"]', 'content')).toBe('noindex');
  });
  test('inlines the theme boot script byte for byte', async () => {
    const doc = dom(await render(Layout, PAGE));
    const inline = [...doc.querySelectorAll('script:not([src])')].map((s) => s.textContent);
    expect(inline).toContain(THEME_BOOT);
  });
  test('serializes JSON-LD safely', async () => {
    const doc = dom(await render(Layout, { ...PAGE, jsonLd: [{ name: '</script>' }] }));
    expect(doc.querySelector('script[type="application/ld+json"]')?.textContent).toBe(
      '{"name":"<\\/script>"}',
    );
  });
});

describe('Header and Footer', () => {
  test('the header has the theme and menu controls and a link to the blog', async () => {
    const doc = dom(await render(Header, { track: LAUNCHED, path: '/' }));
    expect(attr(doc, '[data-action="theme"]', 'aria-pressed')).toBe('false');
    expect(attr(doc, '[data-action="menu"]', 'aria-expanded')).toBe('false');
    expect(doc.querySelector('[data-action="menu"]')?.getAttribute('aria-controls')).toBeTruthy();
    expect(doc.querySelector('a[href="https://josimar-silva.com"]')).not.toBeNull();
  });
  test('the footer links the blog, the listed family, and the home page', async () => {
    const doc = dom(await render(Footer, { track: LAUNCHED, sections: [] }));
    const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'https://josimar-silva.com',
        'https://kafka-animated.josimar-silva.com/',
        'https://learning-animated.com/',
      ]),
    );
    expect(hrefs).not.toContain('https://java.learning-animated.com/');
    expect(doc.body.textContent).toContain('vdev');
  });
  test('a book footer carries the unofficial-companion disclaimer', async () => {
    const book = defineTrack({
      id: 'kafka',
      kind: 'book',
      launched: true,
      site: SITE,
      source: {
        title: 'Kafka: The Definitive Guide',
        edition: '2nd Edition',
        authors: ['Gwen Shapira'],
        publisher: "O'Reilly Media",
        year: 2021,
        url: 'https://example.com/ebook',
      },
    });
    const doc = dom(await render(Footer, { track: book, sections: [] }));
    expect(doc.querySelector('[data-role="footer-disclaimer"]')?.textContent).toContain(
      'An unofficial companion to Kafka: The Definitive Guide, not affiliated with or endorsed by its authors or publisher.',
    );
  });
});

test('the breadcrumb marks the current page', async () => {
  const doc = dom(
    await render(Breadcrumb, {
      trail: [
        { name: 'Contents', path: '/' },
        { name: 'REST', path: '/rest/' },
      ],
    }),
  );
  expect(attr(doc, 'nav', 'aria-label')).toBe('Breadcrumb');
  expect(doc.querySelector('li[aria-current="page"]')?.textContent?.trim()).toBe('REST');
  expect(attr(doc, 'li a', 'href')).toBe('/');
});
