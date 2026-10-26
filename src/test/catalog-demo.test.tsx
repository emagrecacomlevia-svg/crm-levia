import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogDemo } from "@/modules/core/catalog/catalog-demo";

describe("HUB-05 synthetic workspace", () => {
  it("starts without a selected table and labels all amounts as fictional", () => {
    render(<CatalogDemo />);
    expect(screen.getByText("DADOS 100% FICTÍCIOS.")).toBeInTheDocument();
    expect(screen.getByTestId("current-table")).toHaveTextContent("Sem tabela vigente");
    expect(screen.getByText(/Tabela v1 · R\$.*129,00 fictícios/)).toBeInTheDocument();
  });
  it("selects explicitly, expires without fallback, and retains the pinned campaign price", () => {
    render(<CatalogDemo />);
    fireEvent.change(screen.getByLabelText("Tabela a selecionar"), {
      target: { value: "commercial-2" },
    });
    fireEvent.change(screen.getByLabelText("Motivo da seleção"), {
      target: { value: "Seleção para testar o histórico fictício." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar seleção fictícia" }));
    expect(screen.getByTestId("current-table")).toHaveTextContent("Tabela v2 selecionada");
    fireEvent.change(screen.getByLabelText("Data de consulta"), {
      target: { value: "2026-11-01" },
    });
    expect(screen.getByTestId("current-table")).toHaveTextContent("Sem tabela vigente");
    expect(screen.getByText(/Tabela v1 · R\$.*129,00 fictícios/)).toBeInTheDocument();
    expect(screen.getByText("Seleção para testar o histórico fictício.")).toBeInTheDocument();
  });
  it("reports a domain error instead of silently selecting an expired table", () => {
    render(<CatalogDemo />);
    fireEvent.change(screen.getByLabelText("Data de consulta"), {
      target: { value: "2027-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Motivo da seleção"), {
      target: { value: "Tentativa de selecionar versão expirada." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar seleção fictícia" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/vigência/);
    expect(screen.getByTestId("current-table")).toHaveTextContent("Sem tabela vigente");
  });
});
