import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, LayoutGrid, Layers3, BookOpen, UsersRound } from "lucide-react";

import { adminNavigation, type AdminPath } from "@/app/config/admin-navigation";

const icons = {
  overview: LayoutGrid,
  studio: CalendarDays,
  crm: UsersRound,
  core: Layers3,
  catalog: BookOpen,
} as const;

export function AdminNavigation({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegação administrativa" className="flex flex-col gap-1.5">
      {adminNavigation.map((item) => {
        const Icon = icons[item.icon];
        const active = currentPath === item.to || (item.to === "/app" && currentPath === "/app/");
        return (
          <Link
            key={item.to}
            to={item.to as AdminPath}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex min-h-11 items-center gap-3 rounded-xl border-l-[3px] border-olive bg-sage/35 px-3 py-3 text-sm font-semibold text-forest outline-offset-2 focus-visible:outline-2 focus-visible:outline-olive"
                : "flex min-h-11 items-center gap-3 rounded-xl border-l-[3px] border-transparent px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-sage/20 focus-visible:outline-2 focus-visible:outline-olive"
            }
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.6} />
            <span>{item.label}</span>
            {active && <span className="ml-auto text-[10px] font-semibold text-olive">ATUAL</span>}
          </Link>
        );
      })}
      <div className="my-4 border-t border-border" />
      <Link
        to="/"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sage/20 hover:text-forest focus-visible:outline-2 focus-visible:outline-olive"
      >
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.6} />
        Voltar à apresentação inicial
      </Link>
    </nav>
  );
}
