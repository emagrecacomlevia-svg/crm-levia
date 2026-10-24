import { ShieldCheck } from "lucide-react";

import { FeatureGrid, type PlannedFeature } from "@/shared/ui/feature-grid";
import { PageHeader } from "@/shared/ui/page-header";
import { SectionCard } from "@/shared/ui/section-card";
import { StatusIndicator } from "@/shared/ui/status-indicator";

const features: readonly PlannedFeature[] = [
  { name: "Identidade e usuários", description: "Gestão futura de contas, sem login nesta etapa." },
  { name: "Papéis e permissões", description: "Controles reais dependerão de Auth e regras no backend." },
  { name: "Catálogo referencial", description: "Referências validadas, sem importar catálogo histórico." },
  { name: "Versões comerciais", description: "Vigência formal de informações em etapas futuras." },
  { name: "Campanhas e metadados", description: "Classificações e vínculos a definir." },
  { name: "Auditoria", description: "Rastreabilidade futura de alterações e aprovações." },
];

export function CorePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Módulo 03 · Fundação compartilhada"
        title="Núcleo Administrativo"
        description="Referência para governança, identidades e informações compartilhadas. Os recursos ainda não existem e não protegem o acesso a estas páginas públicas."
        aside={<StatusIndicator label="Em preparação" />}
      />
      <SectionCard
        title="Governança como requisito futuro"
        description="Autenticação, autorização e trilhas de auditoria dependem de infraestrutura e decisões posteriores."
      >
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-cream p-5 text-sm leading-6 text-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-olive" />
          Nenhuma conta, permissão de usuário ou trilha de auditoria está ativa.
        </div>
      </SectionCard>
      <div>
        <h2 className="mb-5 text-xl font-semibold text-forest">Capacidades previstas</h2>
        <FeatureGrid features={features} />
      </div>
    </div>
  );
}
