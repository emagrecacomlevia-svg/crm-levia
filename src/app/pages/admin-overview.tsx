import { ArrowUpRight, Blocks, CalendarDays, Layers3, LockKeyhole, UsersRound } from "lucide-react";

import { PageHeader } from "@/shared/ui/page-header";
import { SectionCard } from "@/shared/ui/section-card";
import { StatusIndicator } from "@/shared/ui/status-indicator";

const overview = [
  {
    title: "Social Studio",
    description: "Planejamento, materiais, calendário e revisões por versão.",
    icon: CalendarDays,
    status: "Em preparação",
  },
  {
    title: "CRM de Vendas",
    description: "Espaço reservado, dependente de definição da estratégia empresarial.",
    icon: UsersRound,
    status: "Reservado",
  },
  {
    title: "Núcleo Administrativo",
    description: "Referências, versões, papéis e rastreabilidade planejados.",
    icon: Layers3,
    status: "Em preparação",
  },
] as const;

export function AdminOverviewPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Painel administrativo · demonstração"
        title="LEVIA HUB — Visão Geral"
        description="Um espaço central para organizar o trabalho administrativo da LEVIA BIOSCIENCE. Esta interface é uma demonstração navegável e não contém módulos empresariais ativos."
        aside={<StatusIndicator label="Interface em construção" />}
      />

      <section
        aria-label="Resumo da plataforma"
        className="rounded-3xl bg-forest p-6 text-white sm:p-9"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">
              Panorama da fundação
            </p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
              Uma plataforma. Três frentes planejadas.
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/80">
              Design modular, clareza de navegação e evolução controlada. Nenhum indicador
              comercial, publicação ou registro real é exibido nesta fase.
            </p>
          </div>
          <div className="flex size-14 items-center justify-center rounded-2xl border border-white/25 text-sage">
            <Blocks aria-hidden="true" className="size-7" strokeWidth={1.5} />
          </div>
        </div>
      </section>

      <section aria-labelledby="modules-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="modules-title" className="text-xl font-semibold text-forest">
            Áreas da plataforma
          </h2>
          <span className="text-xs text-muted-foreground">
            03 módulos previstos · não operacionais
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {overview.map((item) => {
            const Icon = item.icon;
            return (
              <SectionCard
                key={item.title}
                title={item.title}
                description={item.description}
                className="flex flex-col"
              >
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
                  <StatusIndicator label={item.status} />
                  <Icon aria-hidden="true" className="size-5 text-olive" strokeWidth={1.6} />
                </div>
              </SectionCard>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Evolução por etapas"
          description="Organização técnica da plataforma, sem simular progresso de campanhas ou vendas."
        >
          <ol className="mt-6 space-y-5">
            <li className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage/50 text-sm font-bold text-forest">
                01
              </span>
              <div>
                <p className="font-semibold text-forest">Fundação técnica · HUB-02</p>
                <p className="mt-1 text-sm text-muted-foreground">
                Identidade institucional, estrutura e testes.
              </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-white">
                02
              </span>
              <div>
                <p className="font-semibold text-forest">Navegação administrativa · HUB-03</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rotas e telas de apresentação, ainda sem operações de negócio.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-sm font-bold text-olive">
                03
              </span>
              <div>
                <p className="font-semibold text-forest">Capacidades futuras</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sujeitas a autorização, definição de segurança e validação técnica.
                </p>
              </div>
            </li>
          </ol>
        </SectionCard>
        <SectionCard
          title="Limites do ambiente"
          description="A demonstração é pública enquanto a proteção de acesso não for implementada."
        >
          <div className="mt-6 rounded-xl bg-cream p-5">
            <LockKeyhole aria-hidden="true" className="size-6 text-olive" strokeWidth={1.6} />
            <p className="mt-3 font-semibold text-forest">Sem autenticação ou banco</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Não insira dados pessoais, comerciais, clínicos ou confidenciais. As telas não salvam,
              publicam, autorizam ou processam informações.
            </p>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs font-medium text-olive">
            <ArrowUpRight aria-hidden="true" className="size-4" />
            Conteúdo exclusivamente ilustrativo
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
