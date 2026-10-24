type StatusIndicatorProps = {
  label: string;
  tone?: "olive" | "neutral";
};

export function StatusIndicator({ label, tone = "olive" }: StatusIndicatorProps) {
  return (
    <span
      className={
        tone === "olive"
          ? "inline-flex items-center gap-2 rounded-full border border-olive/25 bg-sage/25 px-3 py-1.5 text-xs font-semibold text-forest"
          : "inline-flex items-center gap-2 rounded-full border border-border bg-cream px-3 py-1.5 text-xs font-semibold text-foreground"
      }
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-olive" />
      {label}
    </span>
  );
}
