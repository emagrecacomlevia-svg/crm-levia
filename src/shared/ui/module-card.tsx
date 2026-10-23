import { CalendarDays, Layers3, UsersRound } from "lucide-react";

import type { HubModule, HubModuleId } from "@/shared/types/hub-module";

const icons: Record<HubModuleId, typeof CalendarDays> = {
  "social-studio": CalendarDays,
  crm: UsersRound,
  core: Layers3,
};

export function ModuleCard({ module }: { module: HubModule }) {
  const Icon = icons[module.id];

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-7">
      <div className="mb-9 flex items-start justify-between">
        <div className="flex size-12 items-center justify-center rounded-xl bg-sage/40 text-forest">
          <Icon aria-hidden="true" className="size-6" strokeWidth={1.6} />
        </div>
        <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
          {module.number}
        </span>
      </div>

      <div className="mb-3">
        <span className="inline-flex rounded-full border border-border bg-ivory px-3 py-1 text-[11px] font-semibold tracking-wide text-olive">
          {module.status}
        </span>
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-forest">{module.name}</h3>
      <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">{module.description}</p>

      <div className="mt-6 border-t border-border pt-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">
          Escopo previsto
        </p>
        <ul className="space-y-2">
          {module.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-sm text-foreground">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-olive" />
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
