import { BookOpen, CalendarDays } from "lucide-react";

import { FeatureGrid, type PlannedFeature } from "@/shared/ui/feature-grid";
import { PageHeader } from "@/shared/ui/page-header";
import { SectionCard } from "@/shared/ui/section-card";
import { StatusIndicator } from "@/shared/ui/status-indicator";

const features: readonly PlannedFeature[] = [
  { name: "Planejamento editorial", description: "Organização prevista de ciclos, temas e prioridades." },
  { name: "Biblioteca de materiais", description: "Referências futuras aos arquivos originais, sem importar acervo." },
  { name: "Calendário", description: "Visão planejada de atividades e datas editoriais." },
  { name: "Pautas e conteúdos", description: "Estrutura futura para briefings, textos e versões." },
  { name: "Revisões e aprovações", description: "Etapas distintas por versão, canal, finalidade e público." },
  { name: "Publicações manuais", description: "Registro posterior de publicações, sem disparos automáticos." },
];

export function SocialStudioPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Módulo 01 · Comunicação"
        title="Social Studio"
        description="Espaço de referência para o fluxo editorial LEVIA. O conteúdo abaixo descreve recursos futuros; não há biblioteca conectada, editores ou aprovações operacionais."
        aside={<StatusIndicator label="Em preparação" />}
      />
      <section aria-label="Apresentação do Social Studio" className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Ciclo editorial"
          description="Da pauta à revisão, com clareza sobre procedência e versões quando o módulo for autorizado."
        >
          <div className="mt-5 flex items-center gap-3 text-sm text-olive">
            <CalendarDays aria-hidden="true" className="size-5" />
            Planejamento futuro · nenhuma pauta cadastrada
          </div>
        </SectionCard>
        <SectionCard
          title="Materiais com contexto"
          description="Originais permanecerão em suas fontes; versões e direitos dependerão de governança."
        >
          <div className="mt-5 flex items-center gap-3 text-sm text-olive">
            <BookOpen aria-hidden="true" className="size-5" />
            Acervo não conectado · nenhum material exibido
          </div>
        </SectionCard>
      </section>
      <div>
        <h2 className="mb-5 text-xl font-semibold text-forest">Organização prevista</h2>
        <FeatureGrid features={features} />
      </div>
    </div>
  );
}
