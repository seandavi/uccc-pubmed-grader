/**
 * Editorial masthead. Sets the tone before any content shows.
 */
export function Header() {
  return (
    <header className="rule-bottom pb-6 animate-fade-in-up">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <p className="eyebrow">UCCC · Vol. 1</p>
          <h1 className="font-display text-display-xl mt-2 leading-none">
            Publication
            <span className="relative inline-block">
              <span className="font-display italic font-light"> Impact </span>
              <span className="absolute -bottom-1 left-1 right-1 h-[5px] bg-gold/80" aria-hidden />
            </span>
            Grader
          </h1>
          <p className="mt-4 max-w-xl font-sans text-base text-ink2 leading-relaxed">
            A bibliometric reading room for the University of Colorado Cancer Center. Drop a CSV
            of PubMed IDs; we'll fetch each paper's NIH iCite metrics in your browser and produce
            a portfolio summary with RCR distribution, citation tail, and journal mix.
          </p>
        </div>
        <p className="hidden sm:block eyebrow self-end tabular text-ink2">
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
    </header>
  );
}
