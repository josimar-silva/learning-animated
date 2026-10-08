import { defineTrack } from '@learning-animated/site-kit/schemas';

export default defineTrack({
  id: 'kafka',
  kind: 'book',
  launched: false,
  legacyRedirects: true,
  site: {
    url: 'https://kafka.learning-animated.com/',
    name: 'Kafka: The Definitive Guide Animated',
    shortName: 'Kafka Animated',
    tagline: 'A visual companion that animates Kafka internals chapter by chapter.',
    repoUrl: 'https://github.com/josimar-silva/learning-animated',
  },
  source: {
    title: 'Kafka: The Definitive Guide',
    edition: '2nd Edition',
    authors: ['Gwen Shapira', 'Todd Palino', 'Rajini Sivaram', 'Krit Petty'],
    publisher: "O'Reilly Media",
    year: 2021,
    url: 'https://www.confluent.io/resources/ebook/kafka-the-definitive-guide/',
  },
});
