/*
 * Ambient type declarations for third-party libraries that do not currently
 * ship TypeScript typings.  These stubs are **intentionally minimal**, just
 * enough for the Gemeni CLI code-base to compile under `strict` mode.
 */

// ----- lowlight -------------------------------------------------------------
// lowlight exports a `createLowlight` factory function returning an object with
// `register`, `registered`, `highlight` and `highlightAuto` helpers, but the
// exact shape is not important for our usage – `any` is sufficient.

declare module 'lowlight' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createLowlight(...args: any[]): any;
}

declare module 'lowlight/lib/core' {
  // Re-export from primary module to cover deep import paths.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createLowlight(...args: any[]): any;
}

// ----- highlight.js language sub-modules ------------------------------------
// The language grammar modules all default-export a function that attaches the
// grammar to a Highlight.js instance.  The actual signature is irrelevant for
// our purposes.

declare module 'highlight.js/lib/languages/*' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lang: any;
  export default lang;
}