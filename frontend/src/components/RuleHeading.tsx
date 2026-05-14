type Props = {
  eyebrow: string;
  title: string;
};

export function RuleHeading({ eyebrow, title }: Props) {
  return (
    <div className="rule-top pt-6 flex items-baseline justify-between gap-6">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="font-display text-2xl sm:text-3xl mt-2 leading-tight">{title}</h3>
      </div>
    </div>
  );
}
