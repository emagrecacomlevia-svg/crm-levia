import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SecurityDemo } from "@/routes/demo";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

describe("HUB-04 isolated synthetic preview", () => {
  it("states that the preview cannot grant real permissions", () => {
    render(<SecurityDemo />);
    expect(screen.getByText(/AMBIENTE 100% FICTÍCIO/)).toBeInTheDocument();
    expect(screen.getByText(/Acesso negado/)).toBeInTheDocument();
  });

  it("models an active grant but denies revocation and wrong scope", () => {
    render(<SecurityDemo />);
    fireEvent.change(screen.getByLabelText("Selecionar cenário"), {
      target: { value: "allowed" },
    });
    expect(screen.getByTestId("demo-result")).toHaveTextContent("Permitido no cenário fictício");
    fireEvent.change(screen.getByLabelText("Selecionar cenário"), {
      target: { value: "revoked" },
    });
    expect(screen.getByTestId("demo-result")).toHaveTextContent("Acesso negado");
    fireEvent.change(screen.getByLabelText("Selecionar cenário"), {
      target: { value: "other-scope" },
    });
    expect(screen.getByTestId("demo-result")).toHaveTextContent("Acesso negado");
  });
});
