export type Site = { readonly id: string; readonly dir: string; readonly port: number };

// Clear of 4321 and up, where `astro dev` starts, so a running dev server is never mistaken for a preview.
export const SITES: readonly Site[] = [
  { id: 'home', dir: 'home', port: 4400 },
  { id: 'kafka', dir: 'tracks/kafka', port: 4401 },
  { id: 'quarkus', dir: 'tracks/quarkus', port: 4402 },
  { id: 'java', dir: 'tracks/java', port: 4403 },
];

export const TRACKS: readonly Site[] = SITES.filter((site) => site.id !== 'home');

export const origin = (site: Site): string => `http://localhost:${site.port}`;
