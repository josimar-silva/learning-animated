import { stringify } from 'yaml';

export type KafkaChapter = { readonly number: number; readonly slug: string };
export type KafkaAnimation = {
  readonly id: string;
  readonly chapter: number;
  readonly order: number;
  readonly figure: string | null;
  readonly title: string;
  readonly description: string;
  readonly objective: string;
  readonly src: string;
};

// The page already shows the title and the figure, and "View it" describes the old repository.
export function lessonBody(readme: string): string {
  const kept: string[] = [];
  let inFence = false;
  let skipping = false;
  let titled = false;
  for (const line of readme.split('\n')) {
    const heading = !inFence && /^#{1,6} /.test(line);
    if (line.startsWith('```')) inFence = !inFence;
    if (heading && line.startsWith('## ')) skipping = line.trim() === '## View it';
    if (skipping) continue;
    if (heading && line.startsWith('# ') && !titled) {
      titled = true;
      continue;
    }
    if (/^Visualizes \*\*Figure [\d-]+\*\* from /.test(line)) continue;
    kept.push(line);
  }
  return `${kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

export function indexMarkdown(
  animation: KafkaAnimation,
  chapters: readonly KafkaChapter[],
  readme: string,
): string {
  const chapter = chapters.find(({ number }) => number === animation.chapter);
  if (!chapter) throw new Error(`${animation.id}: there is no chapter ${animation.chapter}`);
  const { id, order, figure, title, description, objective } = animation;
  const frontmatter = stringify(
    { id, section: chapter.slug, order, figure, title, description, objective },
    { lineWidth: 0 },
  );
  return `---\n${frontmatter}---\n\n${lessonBody(readme)}`;
}
