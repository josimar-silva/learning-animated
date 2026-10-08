import { expect, test } from 'vitest';

import type { Animation, Section, Track } from './schemas.ts';
import {
  breadcrumbJsonLd,
  learningResourceJsonLd,
  robotsTxt,
  serializeJsonLd,
  websiteJsonLd,
} from './seo.ts';

const SITE = {
  url: 'https://kafka.learning-animated.com/',
  name: 'Kafka: The Definitive Guide Animated',
  shortName: 'Kafka Animated',
  tagline: 'T',
  repoUrl: 'https://github.com/josimar-silva/learning-animated',
};
const SOURCE = {
  title: 'Kafka: The Definitive Guide',
  edition: '2nd Edition',
  authors: ['Gwen Shapira'],
  publisher: "O'Reilly Media",
  year: 2021,
  url: 'https://example.com/ebook',
};
const BOOK: Track = {
  id: 'kafka',
  kind: 'book',
  launched: true,
  legacyRedirects: true,
  site: SITE,
  source: SOURCE,
};
const COURSE: Track = {
  id: 'quarkus',
  kind: 'curriculum',
  launched: false,
  legacyRedirects: false,
  site: { ...SITE, url: 'https://quarkus.learning-animated.com/' },
};
const SECTION: Section = {
  id: 'ch01-meet-kafka',
  number: 1,
  title: 'Meet Kafka',
  description: 'd',
};
const ANIMATION: Animation = {
  id: 'topic-partitions',
  section: 'ch01-meet-kafka',
  order: 1,
  title: 'A topic',
  description: 'd',
  objective: 'o',
  figure: '1-5',
  references: [],
};

test('the website node names the site and its author', () => {
  expect(websiteJsonLd(BOOK)).toMatchObject({
    '@type': 'WebSite',
    name: SITE.name,
    alternateName: 'Kafka Animated',
    url: SITE.url,
    inLanguage: 'en',
    author: { '@type': 'Person', name: 'Josimar Silva', url: 'https://josimar-silva.com' },
  });
});
test('breadcrumbs carry absolute URLs', () => {
  expect(
    breadcrumbJsonLd(BOOK, [
      { name: 'Contents', path: '/' },
      { name: 'Chapter 1: Meet Kafka', path: '/ch01-meet-kafka/' },
    ]).itemListElement[1],
  ).toEqual({
    '@type': 'ListItem',
    position: 2,
    name: 'Chapter 1: Meet Kafka',
    item: 'https://kafka.learning-animated.com/ch01-meet-kafka/',
  });
});
test('a book lesson is about the book and part of its chapter', () => {
  const node = learningResourceJsonLd(BOOK, SECTION, ANIMATION);
  expect(node).toMatchObject({
    '@type': 'LearningResource',
    learningResourceType: 'Animation',
    url: 'https://kafka.learning-animated.com/ch01-meet-kafka/topic-partitions/',
    isPartOf: { name: 'Chapter 1: Meet Kafka' },
    about: { '@type': 'Book', datePublished: '2021' },
  });
  expect(node).not.toHaveProperty('citation');
});
test('a curriculum lesson cites its references and has no book', () => {
  const node = learningResourceJsonLd(
    COURSE,
    { ...SECTION, id: 'rest', title: 'REST' },
    {
      ...ANIMATION,
      section: 'rest',
      figure: null,
      references: [{ label: 'Quarkus REST guide', url: 'https://quarkus.io/guides/rest' }],
    },
  );
  expect(node).not.toHaveProperty('about');
  expect(node).toMatchObject({
    isPartOf: { name: 'REST' },
    citation: [
      {
        '@type': 'CreativeWork',
        name: 'Quarkus REST guide',
        url: 'https://quarkus.io/guides/rest',
      },
    ],
  });
});
test('serialized JSON-LD cannot close its script element', () =>
  expect(serializeJsonLd({ a: '</script>' })).toBe('{"a":"<\\/script>"}'));
test('robots.txt allows a launched site and blocks the rest', () => {
  expect(robotsTxt(BOOK)).toBe(
    'User-agent: *\nAllow: /\n\nSitemap: https://kafka.learning-animated.com/sitemap.xml\n',
  );
  expect(robotsTxt(COURSE)).toBe('User-agent: *\nDisallow: /\n');
});
