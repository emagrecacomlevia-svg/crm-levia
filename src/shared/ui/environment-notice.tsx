import { Info } from "lucide-react";

export function EnvironmentNotice() {
  return (
    <div
      role="note"
      aria-label="Aviso de ambiente"
      className="flex items-start gap-3 rounded-xl border border-olive/20 bg-cream px-5 py-4 text-forest"
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-olive" />
      <div>
        <p className="text-sm font-semibold">
          Ambiente de desenvolvimento — dados demonstrativos.
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Esta página apresenta a fundação do projeto. Os módulos ainda não estão operacionais.
        </p>
      </div>
    </div>
  );
}
