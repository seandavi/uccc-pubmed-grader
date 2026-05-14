/**
 * About page — editorial long-form explanation of what the tool does, the
 * iCite metrics it surfaces, and the methodology / caveats.
 */

import { Link } from "react-router-dom";

const ATTRIBUTION_EMAIL = "seandavi@gmail.com";

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rule-top pt-6">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="font-display text-2xl sm:text-3xl mt-2 leading-tight">{title}</h2>
      <div className="mt-4 font-sans text-base text-ink2 leading-relaxed max-w-3xl space-y-4">
        {children}
      </div>
    </section>
  );
}

export function About() {
  return (
    <article className="mt-12 space-y-12 animate-fade-in-up">
      <header className="rule-bottom pb-8">
        <p className="eyebrow">Colophon · About this tool</p>
        <h1 className="font-display text-display-lg mt-3 leading-tight">
          A bibliometric reading room for
          <span className="italic"> any portfolio of PubMed IDs</span>.
        </h1>
      </header>

      <Section eyebrow="What it does" title="From a CSV to a portfolio summary.">
        <p>
          Drop a CSV that contains a column of PubMed IDs. The browser calls NIH's iCite API
          for each paper, augments your CSV with the iCite bibliometric fields, and renders a
          one-page summary of the portfolio: Relative Citation Ratio distribution, publication
          year mix, top journals, and the most-cited papers.
        </p>
        <p>
          Your CSV file stays in your browser — there is no backend, no upload server, and no
          stored copy on our side. The PMIDs themselves are sent to{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href="https://icite.od.nih.gov/api"
            target="_blank"
            rel="noreferrer"
          >
            NIH iCite
          </a>{" "}
          so it can return their bibliometric data; nothing else in the CSV (additional
          columns, file name, etc.) is transmitted. The augmented CSV download is generated
          locally as a Blob URL.
        </p>
      </Section>

      <Section eyebrow="The metrics" title="What iCite measures, in plain language.">
        <p>
          <strong>Relative Citation Ratio (RCR)</strong> normalizes a paper's citation count
          against the citation rate of the field it sits in (defined by its
          co-citation network). An RCR of 1 is the NIH-funded median; above 2 is generally
          considered high impact; above 10 is exceptional. Because the distribution is heavily
          right-skewed, the dashboard headlines the <em>median</em> RCR — a single landmark
          paper can drag the mean far above what a typical paper in the portfolio looks like.
        </p>
        <p>
          <strong>APT (Approximate Potential to Translate)</strong> is iCite's estimate, on a
          0–1 scale, of how likely a basic-science paper is to be cited by a clinical paper
          downstream. The dashboard reports the fraction of papers at or above 0.5.
        </p>
        <p>
          <strong>Animal / Human / Cellular fractions</strong> reflect iCite's classification
          of subject matter. The dashboard calls a paper "animal-dominant" when its{" "}
          <code className="font-mono text-sm">animal</code> fraction exceeds 0.5.
        </p>
      </Section>

      <Section eyebrow="Caveats" title="What this tool is not.">
        <p>
          iCite does not directly expose <em>NIH-funded</em> attribution per paper. The
          dashboard reports <code className="font-mono text-sm">% with RCR</code>, which is
          the fraction of matched papers iCite was able to score — a close-enough proxy for
          "NIH-tracked" but not a true grant lookup. For real grant attribution you would
          need a second data source (Federal RePORTER / NIH ExPORTER).
        </p>
        <p>
          The tool does not de-duplicate against your institution's records, link papers to
          investigators, or compute author-level rollups. The CSV columns you upload travel
          through unchanged and can be used for that downstream.
        </p>
      </Section>

      <Section eyebrow="How it's built" title="Static SPA, in your browser.">
        <p>
          React 18 + TypeScript, bundled with Vite, packaged by bun, deployed to Netlify.
          Typography pairs Fraunces (display), DM Sans (body), and JetBrains Mono (figures).
          Charts via Recharts. CSV parsing via PapaParse. iCite is queried with batched fetch
          calls and exponential-backoff retry on transient errors.
        </p>
        <p>
          Source is on{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href="https://github.com/seandavi/pubmed-grader"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>{" "}
          under the MIT license.
        </p>
      </Section>

      <Section eyebrow="Attribution" title="Credits and contact.">
        <p>
          Built by{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href={`mailto:${ATTRIBUTION_EMAIL}`}
          >
            Sean Davis
          </a>
          . Data courtesy of the{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href="https://icite.od.nih.gov/"
            target="_blank"
            rel="noreferrer"
          >
            NIH Office of Portfolio Analysis
          </a>{" "}
          via the iCite API. Open Access classification via{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href="https://unpaywall.org/"
            target="_blank"
            rel="noreferrer"
          >
            Unpaywall
          </a>
          . This tool is independent and unaffiliated.
        </p>
      </Section>

      <div className="rule-top pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-eyebrow text-ink2 hover:text-ink transition-colors"
        >
          <span>←</span>
          <span>Back to the upload page</span>
        </Link>
      </div>
    </article>
  );
}
