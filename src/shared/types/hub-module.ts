export type HubModuleId = "social-studio" | "crm" | "core";

export type HubModule = {
  id: HubModuleId;
  number: string;
  name: string;
  description: string;
  status: "Em preparação" | "Planejado";
  highlights: readonly string[];
};
