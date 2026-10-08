// Ports one chapter from the old Kafka repository: KAFKA=<its path> node scripts/port-kafka.ts <chapter slug>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { canonicalStyleBlock } from '@learning-animated/design/canonical';

import { indexMarkdown, type KafkaAnimation, type KafkaChapter } from './lib/kafka-content.ts';
import { portKafkaSvg } from './lib/kafka-style.ts';

const kafka = process.env.KAFKA;
const slug = process.argv[2];
if (!kafka || !slug) {
  console.error('usage: KAFKA=<old repository> node scripts/port-kafka.ts <chapter slug>');
  process.exit(2);
}

const load = async <T>(file: string): Promise<T> =>
  (await import(pathToFileURL(join(kafka, file)).href)) as T;
const { chapters } = await load<{ chapters: KafkaChapter[] }>('src/content/chapters.js');
const { animations } = await load<{ animations: KafkaAnimation[] }>('src/content/animations.js');
const chapter = chapters.find((c) => c.slug === slug);
if (!chapter) {
  console.error(`unknown chapter: ${slug}`);
  process.exit(2);
}

const block = canonicalStyleBlock();
for (const animation of animations.filter((a) => a.chapter === chapter.number)) {
  const target = new URL(
    `../tracks/kafka/src/content/animations/${slug}/${animation.id}/`,
    import.meta.url,
  );
  mkdirSync(target, { recursive: true });
  const svg = readFileSync(join(kafka, animation.src), 'utf8');
  const readme = readFileSync(join(kafka, dirname(animation.src), 'README.md'), 'utf8');
  writeFileSync(new URL(`${animation.id}.svg`, target), portKafkaSvg(svg, block));
  writeFileSync(new URL('index.md', target), indexMarkdown(animation, chapters, readme));
  console.log(`ported ${slug}/${animation.id}`);
}
