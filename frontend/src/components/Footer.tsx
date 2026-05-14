/**
 * Closing colophon. Hairline rule + small-caps eyebrow over a single line
 * of attribution. Stays in the editorial register.
 */

import { Link } from "react-router-dom";

const REPO_URL = "https://github.com/seandavi/uccc-pubmed-grader";

export function Footer() {
  return (
    <footer className="mt-20 rule-top pt-6 pb-2 font-mono text-[0.7rem] uppercase tracking-eyebrow text-muted">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span>© {new Date().getFullYear()} Sean Davis</span>
        <span>MIT License</span>
        <a
          href="https://icite.od.nih.gov/api"
          target="_blank"
          rel="noreferrer"
          className="hover:text-ink transition-colors"
        >
          Data via NIH iCite
        </a>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="hover:text-ink transition-colors"
        >
          Source on GitHub
        </a>
        <Link to="/about" className="hover:text-ink transition-colors ml-auto">
          About →
        </Link>
      </div>
    </footer>
  );
}
