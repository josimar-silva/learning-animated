export type Finding = { readonly where: string; readonly term: number };

export function termsFrom(raw: string | undefined): string[] {
  return (raw ?? '')
    .split('\n')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function findInText(where: string, text: string, terms: readonly string[]): Finding[] {
  const findings: Finding[] = [];
  text.split('\n').forEach((line, i) => {
    const lower = line.toLowerCase();
    terms.forEach((term, k) => {
      if (lower.includes(term)) findings.push({ where: `${where}:${i + 1}`, term: k + 1 });
    });
  });
  return findings;
}

// Locations and term numbers only: CI logs of a public repo are public.
export function report(findings: readonly Finding[]): string {
  return findings.map((f) => `${f.where}: forbidden term #${f.term}`).join('\n');
}
