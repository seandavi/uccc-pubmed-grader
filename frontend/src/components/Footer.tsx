/**
 * Closing colophon. Hairline rule + small-caps eyebrow over a single line
 * of attribution. Stays in the editorial register.
 *
 * The build SHA links to that commit on GitHub so a user can identify
 * exactly which build they're on. (Useful when triaging "this column
 * looks wrong" reports.)
 */

import { Link } from "react-router-dom";

import { GIT_SHA, versionLabel } from "../lib/version";

const REPO_URL = "https://github.com/seandavi/uccc-pubmed-grader";

export function Footer() {
  const commitUrl =
    GIT_SHA === "dev" ? undefined : `${REPO_URL}/commit/${GIT_SHA}`;
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
        <Link to="/columns" className="hover:text-ink transition-colors">
          Data dictionary
        </Link>
        <Link to="/about" className="hover:text-ink transition-colors">
          About
        </Link>
        {commitUrl ? (
          <a
            href={commitUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto hover:text-ink transition-colors tabular"
            title={`Build ${versionLabel()}`}
          >
            {versionLabel()}
          </a>
        ) : (
          <span className="ml-auto tabular">{versionLabel()}</span>
        )}
      </div>
    </footer>
  );
}
