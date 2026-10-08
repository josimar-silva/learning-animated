export type Site = { readonly site: string; readonly dir: string; readonly project: string };

export const SITES: readonly Site[] = [
  { site: 'home', dir: 'home', project: 'learning-animated-home' },
  { site: 'kafka', dir: 'tracks/kafka', project: 'learning-animated-kafka' },
  { site: 'quarkus', dir: 'tracks/quarkus', project: 'learning-animated-quarkus' },
  { site: 'java', dir: 'tracks/java', project: 'learning-animated-java' },
];

const SHARED = [
  /^packages\//,
  /^package(?:-lock)?\.json$/,
  /^tsconfig\.base\.json$/,
  /^\.github\/workflows\/deploy\.yaml$/,
  /^scripts\/lib\/affected\.ts$/,
];

// Shared code rebuilds every site. A track change also rebuilds home, which counts its animations.
export function affectedSites(changed: readonly string[]): Site[] {
  if (changed.some((file) => SHARED.some((re) => re.test(file)))) return [...SITES];
  const touched = new Set(
    SITES.filter(({ dir }) => changed.some((file) => file.startsWith(`${dir}/`))).map(
      (s) => s.site,
    ),
  );
  if ([...touched].some((site) => site !== 'home')) touched.add('home');
  return SITES.filter(({ site }) => touched.has(site));
}
