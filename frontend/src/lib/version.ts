/**
 * Build-time provenance — git SHA and build date — injected by Vite via
 * `define` so they're hard-coded into the bundle. The values come from
 * Netlify's COMMIT_REF env var in production, a local git rev-parse during
 * `bun run build`, or fall back to "dev" / now.
 *
 * Two consumers: the footer (so a user can tell which build they're on)
 * and the augmented CSV (so a downloaded artifact is traceable to a
 * specific app version).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
export const GIT_SHA: string = typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "dev";
export const BUILD_DATE: string =
  typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : new Date().toISOString();

/** Combined version label, e.g. "0.1.0+a659029". */
export function versionLabel(): string {
  return GIT_SHA === "dev" ? `${APP_VERSION}-dev` : `${APP_VERSION}+${GIT_SHA}`;
}
