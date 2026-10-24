import { ClipboardList } from "lucide-react";

import { FeatureGrid, type PlannedFeature } from "@/shared/ui/feature-grid";
import { PageHeader } from "@/shared/ui/page-header";
import { SectionCard } from "@/shared/ui/section-card";
import { StatusIndicator } from "@/shared/ui/status-indicator";

const features: readonly PlannedFeature[] = [
  {
    name: "Empresas e contatos",
    description: "Cadastro e identificação de duplicidades, se autorizado.",
  },
  {
    name: "Oportunidades",
    description: "Registro futuro de etapas, responsáveis e próximas ações.",
  },
  {
    name: "Acompanhamento",
    description: "Histórico, tarefas e prazos para um processo comercial definido.",
  },
  { name: "Relatórios", description: "Indicadores somente após existência de dados válidos." },
];

export function CrmPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Módulo 02 · Área reservada"
        title="CRM de Vendas"
        description="Área arquitetural reservada para gestão de relacionamento comercial. A decisão entre CRM próprio e solução de mercado ainda depende de aprovação empresarial."
        aside={<StatusIndicator label="Implementação pendente" tone="neutral" />}
      />
      <SectionCard
        title="Estratégia ainda em avaliação"
        description="Não existem registros comerciais, formulários de contato, funis operacionais ou indicadores financeiros nesta demonstração."
      >
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-cream p-5 text-sm leading-6 text-foreground">
          <ClipboardList aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-olive" />
          O planejamento desta área não equivale à decisão de construir um CRM próprio.
        </div>
      </SectionCard>
      <div>
        <h2 className="mb-5 text-xl font-semibold text-forest">Recursos em avaliação</h2>
        <FeatureGrid features={features} />
      </div>
    </div>
  );
}
