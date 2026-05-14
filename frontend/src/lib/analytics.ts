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

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: true,
  });
  enabled = true;
}

export function track(event: string, params: Record<string, unknown> = {}): void {
  if (!enabled || typeof window === "undefined") return;
  window.gtag("event", event, params);
}
