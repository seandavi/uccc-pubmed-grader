/**
 * Editorial masthead. Sets the tone before any content shows.
 *
 * The `compact` variant trims the deck so internal pages (About) keep the
 * brand mark without re-stating the entire pitch.
 */

import { Link } from "react-router-dom";

type Props = { compact?: boolean };

export function Header({ compact = false }: Props) {
  return (
    <header className="rule-bottom pb-6 animate-fade-in-up">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <p className="eyebrow">Bibliometrics · Vol. 1</p>
          <Link
            to="/"
            className="block group focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold rounded-sm"
            aria-label="Publication Impact Grader, home"
          >
            <h1 className="font-display text-display-xl mt-2 leading-none">
              Publication
              <span className="relative inline-block">
                <span className="font-display italic font-light"> Impact </span>
                <span
                  className="absolute -bottom-1 left-1 right-1 h-[5px] bg-gold/80 group-hover:h-[7px] transition-all"
                  aria-hidden
                />
              </span>
              Grader
            </h1>
          </Link>
          {!compact && (
            <p className="mt-4 max-w-xl font-sans text-base text-ink2 leading-relaxed">
              A bibliometric reading room for any portfolio of PubMed IDs. Drop a CSV; we'll
              fetch each paper's{" "}
              <a
                className="underline underline-offset-4 hover:text-ink"
                href="https://icite.od.nih.gov/"
                target="_blank"
                rel="noreferrer"
              >
                NIH iCite
              </a>{" "}
              metrics in your browser and produce a portfolio summary with RCR distribution,
              citation tail, and journal mix. We also cross-reference each paper's DOI against{" "}
              <a
                className="underline underline-offset-4 hover:text-ink"
                href="https://unpaywall.org/"
                target="_blank"
                rel="noreferrer"
              >
                Unpaywall
              </a>{" "}
              to flag Open Access status (gold, green, hybrid, bronze, or closed).
            </p>
          )}
        </div>
        <nav className="self-end flex items-center gap-5 font-mono text-[0.7rem] uppercase tracking-eyebrow text-ink2">
          <Link to="/about" className="hover:text-ink transition-colors">
            About
          </Link>
          <span className="hidden sm:inline text-muted tabular">
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </nav>
      </div>
    </header>
  );
}
