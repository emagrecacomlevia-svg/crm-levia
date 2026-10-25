import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HubHome } from "@/app/hub-home";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

describe("LEVIA HUB foundation", () => {
  it("renders the initial page without crashing", () => {
    expect(() => render(<HubHome />)).not.toThrow();
  });

  it("displays the platform name", () => {
    render(<HubHome />);
    expect(screen.getByRole("heading", { level: 1, name: "LEVIA HUB" })).toBeInTheDocument();
  });

  it("identifies LEVIA BIOSCIENCE", () => {
    render(<HubHome />);
    expect(screen.getAllByText(/LEVIA BIOSCIENCE/).length).toBeGreaterThan(0);
  });

  it("shows the demonstration environment disclaimer", () => {
    render(<HubHome />);
    expect(
      screen.getByText("Ambiente de desenvolvimento — dados demonstrativos."),
    ).toBeInTheDocument();
  });

  it("marks planned modules without presenting operational features", () => {
    render(<HubHome />);
    expect(screen.getByRole("heading", { name: "Social Studio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CRM de Vendas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Núcleo Administrativo" })).toBeInTheDocument();
  });

  it("links to the demonstration without suggesting login", () => {
    render(<HubHome />);
    expect(screen.getByRole("link", { name: /Abrir demonstração do HUB/ })).toHaveAttribute(
      "href",
      "/demo",
    );
    expect(screen.queryByRole("button", { name: /entrar|autenticar|salvar|publicar/i })).toBeNull();
  });
});
