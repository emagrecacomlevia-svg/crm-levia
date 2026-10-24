import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/app/layouts/admin-shell";

const routerState = vi.hoisted(() => ({ pathname: "/app" }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="nested-admin-page" />,
  useRouterState: () => routerState.pathname,
}));

describe("LEVIA HUB administrative shell", () => {
  beforeEach(() => {
    routerState.pathname = "/app";
  });

  afterEach(() => {
    document.body.style.pointerEvents = "";
  });

  it("renders a single shared shell and a demonstration notice", () => {
    render(<AdminShell />);
    expect(screen.getByText("LEVIA BIOSCIENCE / LEVIA HUB")).toBeInTheDocument();
    expect(screen.getByText("Ambiente demonstrativo")).toBeInTheDocument();
    expect(screen.getByTestId("nested-admin-page")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "admin-content");
  });

  it("provides a keyboard-discoverable skip link and accessible navigation", () => {
    render(<AdminShell />);
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveAttribute(
      "href",
      "#admin-content",
    );
    expect(
      screen.getByRole("navigation", { name: "Navegação administrativa" }),
    ).toBeInTheDocument();
  });

  it("indicates the active section with text and aria-current", () => {
    routerState.pathname = "/app/crm";
    render(<AdminShell />);
    const link = screen.getByRole("link", { name: /CRM de Vendas/ });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(within(link).getByText("ATUAL")).toBeInTheDocument();
    expect(screen.getByText("CRM de Vendas", { selector: "p" })).toBeInTheDocument();
  });

  it("opens and closes the mobile navigation using accessible controls", async () => {
    render(<AdminShell />);
    const trigger = screen.getByRole("button", { name: "Abrir menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Navegação do LEVIA HUB" });
    expect(within(dialog).getByRole("link", { name: /Social Studio/ })).toHaveAttribute(
      "href",
      "/app/social-studio",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar menu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the mobile navigation after a destination is selected", async () => {
    render(<AdminShell />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("link", { name: /Núcleo Administrativo/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("never pretends these routes are protected", () => {
    render(<AdminShell />);
    expect(screen.getByText(/Rotas públicas · Dados demonstrativos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /login|salvar|aprovar|publicar/i })).toBeNull();
  });
});
