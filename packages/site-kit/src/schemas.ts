import { z } from 'astro/zod';

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export const referenceSchema = z.object({ label: z.string().min(1), url: z.url() });
export const viewSchema = z.object({ id: z.string().regex(SLUG), label: z.string().min(1) });
export const stepSchema = z.object({ at: z.number().nonnegative(), text: z.string().min(1) });

export const sectionSchema = z.object({
  id: z.string().regex(SLUG),
  number: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
});
// Astro's file() loader keys each entry by id and hands the rest over as data.
export const sectionDataSchema = sectionSchema.omit({ id: true });

export const animationSchema = z.object({
  id: z.string().regex(SLUG),
  section: z.string().regex(SLUG),
  order: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  objective: z.string().min(1),
  figure: z
    .string()
    .regex(/^\d+-\d+$/)
    .nullable()
    .default(null),
  references: z.array(referenceSchema).default([]),
  views: z.array(viewSchema).min(2).optional(),
  steps: z.array(stepSchema).min(1).optional(),
});

export const trackSchema = z.object({
  id: z.string().regex(SLUG),
  kind: z.enum(['book', 'curriculum', 'home']),
  launched: z.boolean(),
  legacyRedirects: z.boolean().default(false),
  site: z.object({
    url: z.url(),
    name: z.string().min(1),
    shortName: z.string().min(1),
    tagline: z.string().min(1),
    repoUrl: z.url(),
  }),
  source: z
    .object({
      title: z.string().min(1),
      edition: z.string().min(1),
      authors: z.array(z.string().min(1)).min(1),
      publisher: z.string().min(1),
      year: z.number().int(),
      url: z.url(),
    })
    .optional(),
});

export type Reference = z.infer<typeof referenceSchema>;
export type View = z.infer<typeof viewSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Animation = z.infer<typeof animationSchema>;
export type Track = z.infer<typeof trackSchema>;

export function defineTrack(input: z.input<typeof trackSchema>): Track {
  const track = trackSchema.parse(input);
  if (track.kind === 'book' && !track.source)
    throw new Error(`track "${track.id}" is a book and needs a source`);
  if (!track.site.url.endsWith('/'))
    throw new Error(`track "${track.id}" site.url must end with /`);
  return track;
}
