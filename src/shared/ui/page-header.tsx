import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, aside }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-forest sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {aside}
    </div>
  );
}
