import { ArrowDownRight, Check, ShieldCheck } from "lucide-react";

import { HubShell } from "@/app/layouts/hub-shell";
import { hubModules } from "@/shared/lib/hub-modules";
import { EnvironmentNotice } from "@/shared/ui/environment-notice";
import { ModuleCard } from "@/shared/ui/module-card";

export function HubHome() {
  return (
    <HubShell>
      <section className="relative isolate overflow-hidden bg-forest text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 top-0 size-[28rem] rounded-full border border-white/10 md:size-[38rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 top-14 size-[22rem] rounded-full border border-white/10 md:size-[32rem]"
        />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-28">
          <div>
            <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-sage">
              <span aria-hidden="true" className="h-px w-9 bg-sage" />
              Centro administrativo digital
            </p>
            <h1 className="font-serif text-6xl font-normal tracking-tight sm:text-7xl lg:text-8xl">
              LEVIA HUB
            </h1>
            <p className="mt-7 max-w-xl text-xl leading-relaxed text-white/85">
              Uma base para organizar o presente e construir, com critério, o próximo capítulo da
              LEVIA BIOSCIENCE.
            </p>
            <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-sage">
              <span aria-hidden="true" className="size-2 rounded-full bg-sage" />
              FUNDAÇÃO TÉCNICA · HUB-02
            </div>
          </div>

          <aside
            aria-label="Princípios da fundação"
            className="relative rounded-3xl border border-white/20 bg-white/10 p-7 backdrop-blur-sm sm:p-9"
          >
            <p className="text-xs font-semibold tracking-[0.22em] text-sage">
              PRINCÍPIOS DA PLATAFORMA
            </p>
            <div className="mt-8 space-y-7">
              <div className="flex gap-4">
                <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-sage" />
                <div>
                  <p className="text-lg font-semibold">Modular por natureza</p>
                  <p className="mt-1 text-sm leading-6 text-white/70">
                    Áreas independentes, com uma fundação compartilhada e enxuta.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <ShieldCheck aria-hidden="true" className="mt-1 size-5 shrink-0 text-sage" />
                <div>
                  <p className="text-lg font-semibold">Governança desde o início</p>
                  <p className="mt-1 text-sm leading-6 text-white/70">
                    Preparado para receber regras de acesso, revisão e rastreabilidade em etapas
                    futuras.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-white/20 pt-5 text-xs text-sage">
              <span>EVOLUÇÃO CONTROLADA</span>
              <ArrowDownRight aria-hidden="true" className="size-5" />
            </div>
          </aside>
        </div>
      </section>

      <section id="modulos" className="scroll-mt-8 bg-background py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.23em] text-olive">
              Estrutura em construção
            </p>
            <h2 className="mt-4 font-serif text-4xl font-normal tracking-tight text-forest sm:text-5xl">
              Áreas do LEVIA HUB
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">
              Três frentes planejadas para uma operação digital mais clara. Os cartões abaixo
              apresentam apenas a direção arquitetural, não funcionalidades ativas.
            </p>
          </div>
          <div className="mt-11 grid gap-5 md:grid-cols-3">
            {hubModules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>
      </section>

      <section id="sobre" className="scroll-mt-8 border-t border-border bg-card py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.23em] text-olive">
              Entrega incremental
            </p>
            <h2 className="mt-3 font-serif text-3xl font-normal text-forest">
              Construir com responsabilidade.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Esta fase estabelece a apresentação institucional e a organização do código. O
              desenvolvimento de módulos, controles de acesso e integrações depende de novas etapas.
            </p>
          </div>
          <EnvironmentNotice />
        </div>
      </section>
    </HubShell>
  );
}
