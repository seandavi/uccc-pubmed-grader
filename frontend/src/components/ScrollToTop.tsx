/**
 * Scroll restoration: scroll to top whenever the path changes. Without this,
 * landing on /about after clicking the footer link drops the user partway
 * down the page (they were already at the bottom on /).
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
