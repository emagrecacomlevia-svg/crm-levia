import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HubHome } from "@/app/hub-home";

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
});
