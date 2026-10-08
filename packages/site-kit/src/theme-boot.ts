// Runs before first paint so a dark-theme reader never sees a white flash. The CSP
// allows it by the hash of this exact text, so any edit changes the policy.
export const THEME_BOOT =
  "try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}";
