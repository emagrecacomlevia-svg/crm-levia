import { SectionCard } from "@/shared/ui/section-card";
import { StatusIndicator } from "@/shared/ui/status-indicator";

export type PlannedFeature = {
  name: string;
  description: string;
};

export function FeatureGrid({ features }: { features: readonly PlannedFeature[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Recursos planejados">
      {features.map((feature) => (
        <SectionCard key={feature.name} title={feature.name} description={feature.description}>
          <div className="mt-5">
            <StatusIndicator label="Previsto" tone="neutral" />
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
