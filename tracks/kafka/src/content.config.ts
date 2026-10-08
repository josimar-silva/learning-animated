import { animationSchema, sectionDataSchema } from '@learning-animated/site-kit/schemas';
import { file, glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

export const collections = {
  sections: defineCollection({
    loader: file('src/content/sections.json'),
    schema: sectionDataSchema,
  }),
  animations: defineCollection({
    loader: glob({ base: './src/content/animations', pattern: '**/index.md' }),
    schema: animationSchema,
  }),
};
