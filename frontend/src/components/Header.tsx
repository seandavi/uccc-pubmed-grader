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
          <a
            href="https://github.com/seandavi/pubmed-grader"
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            title="Source on GitHub"
            className="inline-flex items-center hover:text-ink transition-colors"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="w-4 h-4 fill-current">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
          </a>
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
