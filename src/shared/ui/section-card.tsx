import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function SectionCard({ title, description, children, className = "" }: SectionCardProps) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}>
      <h2 className="text-lg font-semibold tracking-tight text-forest">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
