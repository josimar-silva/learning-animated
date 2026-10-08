/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';

import { getViteConfig } from 'astro/config';

// Components compile with the build's whitespace rules (see the integration), so tests see the shipped text.
export default getViteConfig(
  { test: { name: 'site-kit', environment: 'node' } },
  { root: fileURLToPath(new URL('.', import.meta.url)), compressHTML: true },
);
