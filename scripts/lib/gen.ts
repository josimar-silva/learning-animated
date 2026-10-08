export function svgPathFor(genPath: string): string {
  if (!genPath.endsWith('.gen.ts')) throw new Error(`not a generator: ${genPath}`);
  return genPath.replace(/\.gen\.ts$/, '.svg');
}
