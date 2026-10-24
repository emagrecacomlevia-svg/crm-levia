import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminOverviewPage } from "@/app/pages/admin-overview";
import { CorePage } from "@/modules/core/pages";
import { CrmPage } from "@/modules/crm/pages";
import { SocialStudioPage } from "@/modules/social-studio/pages";

describe("Administrative demonstration pages", () => {
  it("renders the dashboard with planned modules and no business metrics", () => {
    render(<AdminOverviewPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "LEVIA HUB — Visão Geral" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/03 módulos previstos/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum indicador comercial/)).toBeInTheDocument();
  });

  it("renders Social Studio planning areas without action forms", () => {
    render(<SocialStudioPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Social Studio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planejamento editorial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revisões e aprovações" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the reserved CRM without fictional commercial figures", () => {
    render(<CrmPage />);
    expect(screen.getByRole("heading", { level: 1, name: "CRM de Vendas" })).toBeInTheDocument();
    expect(screen.getByText(/Implementação pendente/)).toBeInTheDocument();
    expect(screen.getByText(/não existem registros comerciais/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders planned core governance without operational authentication", () => {
    render(<CorePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Núcleo Administrativo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Papéis e permissões" })).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma conta, permissão de usuário/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
