/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly LA_VERSION?: string;
}

// Plain tsc cannot read .astro files (astro check can), so tests import them through this declaration.
declare module '*.astro' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}
