import { describe, expect, test } from 'vitest';

import { dom } from '../../test/dom.ts';
import { render } from '../../test/render.ts';
import type { Animation, Section } from '../schemas.ts';
import { defineTrack } from '../schemas.ts';
import AboutPage from './AboutPage.astro';
import AnimationPage from './AnimationPage.astro';
import FamilyHomePage from './FamilyHomePage.astro';
import HomePage from './HomePage.astro';
import NotFoundPage from './NotFoundPage.astro';
import SectionPage from './SectionPage.astro';

const SITE = {
  url: 'https://quarkus.learning-animated.com/',
  name: 'Quarkus Animated',
  shortName: 'Quarkus Animated',
  tagline: 'T',
  repoUrl: 'https://github.com/josimar-silva/learning-animated',
};
const COURSE = defineTrack({ id: 'quarkus', kind: 'curriculum', launched: true, site: SITE });
const BOOK = defineTrack({
  id: 'kafka',
  kind: 'book',
  launched: true,
  legacyRedirects: true,
  site: {
    ...SITE,
    url: 'https://kafka.learning-animated.com/',
    name: 'Kafka: The Definitive Guide Animated',
  },
  source: {
    title: 'Kafka: The Definitive Guide',
    edition: '2nd Edition',
    authors: ['Gwen Shapira'],
    publisher: "O'Reilly Media",
    year: 2021,
    url: 'https://example.com/ebook',
  },
});
const THREADING: Section = {
  id: 'threading',
  number: 1,
  title: 'Threading model',
  description: 'How work is split.',
};
const LESSON: Animation = {
  id: 'io-vs-worker-threads',
  section: 'threading',
  order: 1,
  title: 'I/O thread vs worker thread',
  description: 'D',
  objective: 'Notice the free event loop.',
  figure: null,
  references: [{ label: 'Quarkus REST guide', url: 'https://quarkus.io/guides/rest' }],
};
const VIEW = {
  id: null,
  label: null,
  src: '/embed/io-vs-worker-threads.svg',
  width: 1100,
  height: 970,
};
const base = {
  track: COURSE,
  section: THREADING,
  animation: LESSON,
  views: [VIEW],
  loop: null,
  prev: null,
  next: null,
  sections: [],
};
const page = async (props: Record<string, unknown>, slot = '<p>Concept</p>') =>
  dom(await render(AnimationPage, props, { default: slot }));
const jsonLd = (doc: Document) =>
  [...doc.querySelectorAll('script[type="application/ld+json"]')].map(
    (s) =>
      JSON.parse(s.textContent ?? 'null') as {
        '@type': string;
        itemListElement?: Array<{ name: string }>;
      },
  );

describe('AnimationPage', () => {
  test('titles a curriculum lesson with its section', async () =>
    expect((await page(base)).querySelector('title')?.textContent?.trim()).toBe(
      'I/O thread vs worker thread | Threading model | Quarkus Animated',
    ));
  test('titles a book lesson with its chapter number', async () => {
    const doc = await page({
      ...base,
      track: BOOK,
      animation: { ...LESSON, figure: '1-5', references: [] },
    });
    expect(doc.querySelector('title')?.textContent?.trim()).toBe(
      'I/O thread vs worker thread | Chapter 1 | Kafka: The Definitive Guide Animated',
    );
    expect(doc.querySelector('[data-role="figure"]')?.textContent?.trim()).toBe('Figure 1-5');
  });
  test("a book lesson keeps Kafka's JSON-LD: the trail first, ending at the figure", async () => {
    const doc = await page({
      ...base,
      track: BOOK,
      animation: { ...LESSON, figure: '1-5', references: [] },
    });
    const blocks = jsonLd(doc);
    expect(blocks.map((b) => b['@type'])).toEqual(['BreadcrumbList', 'LearningResource']);
    expect(blocks[0]?.itemListElement?.map((item) => item.name)).toEqual([
      'Contents',
      'Chapter 1: Threading model',
      'Figure 1-5',
    ]);
  });
  test('puts the first view on a stage sized by its viewBox', async () => {
    const stage = (await page(base)).querySelector('[data-role="stage"]');
    expect(stage?.querySelector('object')?.getAttribute('data')).toBe(
      '/embed/io-vs-worker-threads.svg',
    );
    expect(stage?.getAttribute('style')).toBe('aspect-ratio: 1100 / 970');
  });
  test('shows the objective, the concept, and the references', async () => {
    const doc = await page(base);
    expect(doc.querySelector('[data-role="objective"]')?.textContent?.trim()).toBe(
      'Notice the free event loop.',
    );
    expect(doc.body.innerHTML).toContain('<p>Concept</p>');
    expect(doc.querySelector('[data-role="reference"] a')?.getAttribute('rel')).toBe('noopener');
  });
  test('offers absolute embed snippets', async () =>
    expect((await page(base)).querySelector('[data-role="embed"]')?.textContent).toContain(
      '![I/O thread vs worker thread](https://quarkus.learning-animated.com/embed/io-vs-worker-threads.svg)',
    ));
  test('toggles between before and after views', async () => {
    const views = [
      { ...VIEW, id: 'before', label: 'Before', src: '/embed/x.before.svg' },
      { ...VIEW, id: 'after', label: 'After', src: '/embed/x.after.svg' },
    ];
    const doc = await page({ ...base, views });
    const buttons = [...doc.querySelectorAll('[data-action="view"]')];
    expect(
      buttons.map((b) => [b.getAttribute('data-src'), b.getAttribute('aria-pressed')]),
    ).toEqual([
      ['/embed/x.before.svg', 'true'],
      ['/embed/x.after.svg', 'false'],
    ]);
    expect(doc.querySelector('[data-role="stage"] object')?.getAttribute('data')).toBe(
      '/embed/x.before.svg',
    );
  });
  test('a single view has no toggle', async () =>
    expect((await page(base)).querySelector('[data-action="view"]')).toBeNull());
  test('steps and a scrubber appear only with a loop', async () => {
    const stepped = {
      ...base,
      loop: 13.5,
      animation: {
        ...LESSON,
        steps: [
          { at: 0, text: 'A arrives' },
          { at: 3.4, text: 'B blocks' },
        ],
      },
    };
    const doc = await page(stepped);
    expect(
      [...doc.querySelectorAll('[data-role="step"]')].map((s) => s.getAttribute('data-at')),
    ).toEqual(['0', '3.4']);
    expect(doc.querySelector('[data-role="scrubber"]')?.getAttribute('max')).toBe('13.5');
    expect((await page(base)).querySelector('[data-role="scrubber"]')).toBeNull();
  });
  test('links the previous and next lessons', async () => {
    const doc = await page({
      ...base,
      prev: { ...LESSON, id: 'a', title: 'A' },
      next: { ...LESSON, id: 'b', title: 'B' },
    });
    expect(doc.querySelector('[data-role="prev"]')?.getAttribute('href')).toBe('/threading/a/');
    expect(doc.querySelector('[data-role="next"]')?.getAttribute('href')).toBe('/threading/b/');
  });
});

describe('HomePage and SectionPage', () => {
  const contents = [
    { ...THREADING, animations: [LESSON] },
    { id: 'rest', number: 2, title: 'REST endpoints', description: 'd', animations: [] },
  ];
  test('lists every section and marks empty ones as planned', async () => {
    const doc = dom(await render(HomePage, { track: COURSE, contents }));
    expect(doc.querySelector('title')?.textContent?.trim()).toBe('Quarkus Animated');
    expect(
      [...doc.querySelectorAll('[data-planned]')].map((c) => c.getAttribute('data-planned')),
    ).toEqual(['false', 'true']);
    expect(doc.querySelector('[data-role="anim-link"]')?.getAttribute('href')).toBe(
      '/threading/io-vs-worker-threads/',
    );
  });
  test('a home with no lessons yet shows every section as planned', async () => {
    const doc = dom(
      await render(HomePage, {
        track: COURSE,
        contents: contents.map((s) => ({ ...s, animations: [] })),
      }),
    );
    expect(
      [...doc.querySelectorAll('[data-planned]')].map((c) => c.getAttribute('data-planned')),
    ).toEqual(['true', 'true']);
    expect(doc.querySelector('[data-role="anim-link"]')).toBeNull();
  });
  test('a book home walks through the three steps and embeds the legacy map', async () => {
    const doc = dom(
      await render(HomePage, {
        track: BOOK,
        contents,
        legacyMap: { acks: '/ch03-kafka-producers/acks/' },
      }),
    );
    expect(doc.querySelectorAll('.step')).toHaveLength(3);
    expect(doc.querySelector('script[data-role="legacy-map"]')?.textContent).toBe(
      '{"acks":"/ch03-kafka-producers/acks/"}',
    );
  });
  test('a section page lists its lessons in order', async () => {
    const doc = dom(
      await render(SectionPage, {
        track: COURSE,
        section: THREADING,
        animations: [LESSON],
        prev: null,
        next: null,
        sections: [],
      }),
    );
    expect(doc.querySelector('title')?.textContent?.trim()).toBe(
      'Threading model | Quarkus Animated',
    );
    expect(doc.querySelectorAll('[data-role="anim-link"]')).toHaveLength(1);
  });
  test("a book section page ends its trail at the chapter number, as Kafka's did", async () => {
    const doc = dom(
      await render(SectionPage, {
        track: BOOK,
        section: THREADING,
        animations: [LESSON],
        prev: null,
        next: null,
        sections: [],
      }),
    );
    expect(jsonLd(doc)[0]?.itemListElement?.map((item) => item.name)).toEqual([
      'Contents',
      'Chapter 1',
    ]);
  });
});

describe('AboutPage and NotFoundPage', () => {
  test('the about page carries about.md and describes a book as a companion', async () => {
    const doc = dom(
      await render(AboutPage, { track: BOOK, sections: [] }, { default: '<p>About text</p>' }),
    );
    expect(doc.querySelector('title')?.textContent?.trim()).toBe(
      'About | Kafka: The Definitive Guide Animated',
    );
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'What Kafka: The Definitive Guide Animated is, how to follow along with the book, and how the companion is built.',
    );
    expect(doc.body.innerHTML).toContain('<p>About text</p>');
    const course = dom(await render(AboutPage, { track: COURSE, sections: [] }));
    expect(course.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'What Quarkus Animated is and how it is built.',
    );
  });
  test('the not-found page stays out of search and links back to the contents', async () => {
    const doc = dom(await render(NotFoundPage, { track: COURSE }));
    expect(doc.querySelector('title')?.textContent?.trim()).toBe(
      'Page not found | Quarkus Animated',
    );
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(doc.querySelector('main a[href="/"]')).not.toBeNull();
  });
});

test('every page has exactly one h1', async () => {
  const pages = [
    dom(
      await render(HomePage, { track: BOOK, contents: [{ ...THREADING, animations: [LESSON] }] }),
    ),
    dom(
      await render(SectionPage, {
        track: COURSE,
        section: THREADING,
        animations: [LESSON],
        prev: null,
        next: null,
        sections: [],
      }),
    ),
    await page(base),
    dom(await render(AboutPage, { track: COURSE, sections: [] })),
    dom(await render(NotFoundPage, { track: COURSE })),
    dom(await render(FamilyHomePage, { track: COURSE, members: [] })),
  ];
  expect(pages.map((doc) => doc.querySelectorAll('h1').length)).toEqual([1, 1, 1, 1, 1, 1]);
});

test('the family home links every listed member with its count', async () => {
  const home = defineTrack({
    id: 'home',
    kind: 'home',
    launched: true,
    site: { ...SITE, url: 'https://learning-animated.com/', name: 'Learning Animated' },
  });
  const doc = dom(
    await render(FamilyHomePage, {
      track: home,
      members: [
        {
          name: 'Kafka Animated',
          tagline: 'T',
          url: 'https://kafka-animated.josimar-silva.com/',
          count: 17,
        },
      ],
    }),
  );
  expect(
    doc.querySelector('a[href="https://kafka-animated.josimar-silva.com/"]')?.textContent,
  ).toContain('Kafka Animated');
  expect(doc.body.textContent).toContain('17 animations');
});
