import { learningAnimated } from '@learning-animated/site-kit/integration';
import { defineConfig } from 'astro/config';

import track from './src/track.ts';

export default defineConfig({ integrations: [learningAnimated({ track })] });
