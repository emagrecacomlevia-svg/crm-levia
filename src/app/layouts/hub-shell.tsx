import { Leaf } from "lucide-react";
import type { ReactNode } from "react";

export function HubShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5 lg:px-10">
          <a
            href="/#inicio"
            aria-label="LEVIA BIOSCIENCE — início"
            className="inline-flex items-center gap-3 text-forest"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-forest/15 bg-sage/30">
              <Leaf aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-lg font-semibold tracking-[0.24em]">LEVIA</span>
              <span className="mt-1 text-[9px] font-medium tracking-[0.28em]">BIOSCIENCE</span>
            </span>
          </a>

          <nav aria-label="Navegação principal" className="flex items-center gap-6">
            <a href="/#modulos" className="text-sm font-medium text-foreground hover:text-olive">
              Módulos
            </a>
            <a href="/#sobre" className="text-sm font-medium text-foreground hover:text-olive">
              Sobre a fundação
            </a>
          </nav>
        </div>
      </header>

      <main id="inicio">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground lg:px-10">
          <span>LEVIA BIOSCIENCE · LEVIA HUB</span>
          <span>Fundação técnica HUB-02 · Sem ambiente de produção</span>
        </div>
      </footer>
    </div>
  );
}
