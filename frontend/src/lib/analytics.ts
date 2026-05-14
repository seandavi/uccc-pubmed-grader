/**
 * Google Analytics 4 wrapper. Loads only when `VITE_GA_MEASUREMENT_ID` is set;
 * otherwise `track()` is a no-op (handy for local dev and self-hosting).
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let enabled = false;

export function initAnalytics(): void {
  if (!MEASUREMENT_ID) return;
  if (typeof window === "undefined") return;

  // Mirror Google's canonical gtag snippet exactly: a plain `function` that
  // pushes the `arguments` object, NOT a rest-params arrow that pushes a
  // real Array. gtag.js's queue-replay logic only processes dataLayer
  // entries whose shape matches `arguments`; Array entries are silently
  // skipped, no page_view fires, and every subsequent gtag() call is
  // dropped on the floor (verified empirically against the live site).
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments as unknown as unknown[]);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  enabled = true;
}

export function track(event: string, params: Record<string, unknown> = {}): void {
  if (!enabled || typeof window === "undefined") return;
  window.gtag("event", event, params);
}
