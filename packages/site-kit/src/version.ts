// The repo version, which the integration defines at build time. Tests see 'dev'.
export const siteVersion = (): string => import.meta.env.LA_VERSION ?? 'dev';
