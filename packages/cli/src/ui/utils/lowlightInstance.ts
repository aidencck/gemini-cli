// `lowlight` does not ship its own type declarations (yet).  
// Suppress the missing type errors so that `tsc` will accept the import.
import { createLowlight } from 'lowlight';

// Import only the languages that are actually rendered by the CLI UI.  
// Add additional languages here when required but avoid the full `common` set
// to keep the bundled size small.
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import diff from 'highlight.js/lib/languages/diff';

/**
 * A singleton Lowlight instance with a curated list of languages.  
 * Importing this module instead of `lowlight` directly avoids bundling the
 * entire language registry, cutting ~200-300 kB from the final bundle.
 */
export const lowlight = (() => {
  const instance = createLowlight();
  instance.register({ javascript });
  instance.register({ typescript });
  instance.register({ json });
  instance.register({ bash });
  instance.register({ diff });
  return instance;
})();