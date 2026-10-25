import * as Dialog from "@radix-ui/react-dialog";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Leaf, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

import { adminPageNames, type AdminPath } from "@/app/config/admin-navigation";
import { AdminNavigation } from "@/app/layouts/admin-navigation";
import { signOutFn } from "@/modules/identity/auth.functions";

function AdminBrand() {
  return (
    <Link
      to="/app"
      className="flex items-center gap-3 rounded-lg text-forest outline-offset-4 focus-visible:outline-2 focus-visible:outline-olive"
      aria-label="LEVIA HUB — Visão Geral"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest text-white">
        <Leaf aria-hidden="true" className="size-5" strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-semibold tracking-[0.16em]">LEVIA HUB</span>
        <span className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground">
          LEVIA BIOSCIENCE
        </span>
      </span>
    </Link>
  );
}

export function AdminShell() {
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (logoutPending) return;
    setLogoutError("");
    setLogoutPending(true);
    try {
      // Even if remote revocation fails, local session is cleared server-side.
      await signOutFn();
      window.location.assign("/login");
    } catch {
      setLogoutError("Não foi possível encerrar a sessão. Tente novamente.");
      setLogoutPending(false);
    }
  }
  const section = adminPageNames[currentPath as AdminPath] ?? "Área administrativa";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <a
        href="#admin-content"
        className="sr-only z-50 rounded-lg bg-card px-4 py-3 text-forest focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-border bg-card px-5 py-7 lg:flex">
        <div className="mb-11 px-2">
          <AdminBrand />
        </div>
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-olive">
          Espaços do HUB
        </p>
        <AdminNavigation currentPath={currentPath} />
        <div className="mt-auto border-t border-border px-3 pt-5 text-xs leading-6 text-muted-foreground">
          <p>HUB-04 · Área de acesso condicionado</p>
          <p>Dados dos módulos ainda demonstrativos.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="flex min-h-20 flex-wrap items-center gap-4 px-4 py-4 sm:px-7 lg:px-10">
            <div className="lg:hidden">
              <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Abrir menu"
                    aria-expanded={mobileOpen}
                    className="inline-flex size-11 items-center justify-center rounded-lg border border-border text-forest hover:bg-sage/20 focus-visible:outline-2 focus-visible:outline-olive"
                  >
                    <Menu aria-hidden="true" className="size-5" />
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-40 bg-forest/55" />
                  <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(19rem,calc(100vw-2rem))] flex-col overflow-y-auto bg-card p-5 shadow-xl">
                    <div className="mb-9 flex items-center justify-between gap-3">
                      <Dialog.Title className="text-base font-semibold text-forest">
                        Navegação do LEVIA HUB
                      </Dialog.Title>
                      <Dialog.Close
                        aria-label="Fechar menu"
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-forest focus-visible:outline-2 focus-visible:outline-olive"
                      >
                        <X aria-hidden="true" className="size-5" />
                      </Dialog.Close>
                    </div>
                    <Dialog.Description className="sr-only">
                      Selecione uma seção demonstrativa do LEVIA HUB.
                    </Dialog.Description>
                    <AdminNavigation
                      currentPath={currentPath}
                      onNavigate={() => setMobileOpen(false)}
                    />
                    <p className="mt-auto border-t border-border pt-6 text-xs text-muted-foreground">
                      Navegação administrativa protegida por autenticação e autorização.
                    </p>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-olive">
                LEVIA BIOSCIENCE / LEVIA HUB
              </p>
              <p className="mt-1 truncate text-base font-semibold text-forest">{section}</p>
            </div>
            <span className="rounded-full border border-olive/25 bg-sage/25 px-3 py-2 text-[11px] font-semibold text-forest sm:text-xs">
              Ambiente demonstrativo
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutPending}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-forest disabled:opacity-50"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {logoutPending ? "Encerrando..." : "Sair"}
            </button>
            {logoutError && <p role="alert" className="text-sm text-destructive">{logoutError}</p>}
          </div>
        </header>

        <main
          id="admin-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-8 sm:px-7 sm:py-10 lg:px-10"
        >
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border bg-card px-4 py-4 text-xs text-muted-foreground sm:px-7 lg:px-10">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2">
            <span>LEVIA HUB · HUB-04</span>
            <span>Rotas protegidas · Dados demonstrativos · Sem persistência dos módulos</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
