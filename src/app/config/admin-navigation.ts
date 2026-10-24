export const adminNavigation = [
  { to: "/app", label: "Visão Geral", icon: "overview" },
  { to: "/app/social-studio", label: "Social Studio", icon: "studio" },
  { to: "/app/crm", label: "CRM de Vendas", icon: "crm" },
  { to: "/app/core", label: "Núcleo Administrativo", icon: "core" },
] as const;

export type AdminPath = (typeof adminNavigation)[number]["to"];

export const adminPageNames: Record<AdminPath, string> = {
  "/app": "Visão Geral",
  "/app/social-studio": "Social Studio",
  "/app/crm": "CRM de Vendas",
  "/app/core": "Núcleo Administrativo",
};
