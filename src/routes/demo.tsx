import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";

import { HubShell } from "@/app/layouts/hub-shell";
import {
  canAccess,
  type AdminAccount,
  type PermissionGrant,
} from "@/modules/identity/domain/permissions";

export const Route = createFileRoute("/demo")({
  component: SecurityDemo,
  headers: () => ({ "Cache-Control": "public, max-age=60" }),
});

type Scenario = "allowed" | "anonymous" | "disabled" | "revoked" | "expired" | "other-scope";

const scenarios: { id: Scenario; name: string; description: string }[] = [
  { id: "allowed", name: "Conta fictícia habilitada", description: "Concessão válida no escopo exato." },
  { id: "anonymous", name: "Sem autenticação", description: "Nenhuma identidade comprovada." },
  { id: "disabled", name: "Conta desabilitada", description: "A identidade existe, mas está suspensa." },
  { id: "revoked", name: "Concessão revogada", description: "A concessão não pode mais ser usada." },
  { id: "expired", name: "Concessão expirada", description: "A janela de acesso chegou ao fim." },
  { id: "other-scope", name: "Escopo incorreto", description: "A permissão é de outra carteira." },
];

const subject = "USUARIO-FICTICIO-001";
const fakeAccount: AdminAccount = {
  authUserId: subject,
  isEnabled: true,
  disabledAt: null,
};

const fakeGrant: PermissionGrant = {
  subjectUserId: subject,
  capabilityCode: "crm.read",
  scopeKind: "resource",
  scopeKey: "crm:carteira-a",
  validFrom: "2026-01-01T00:00:00Z",
  validUntil: null,
  revokedAt: null,
};

function evaluateScenario(scenario: Scenario): boolean {
  const account =
    scenario === "disabled"
      ? { ...fakeAccount, isEnabled: false, disabledAt: "2026-09-01T00:00:00Z" }
      : fakeAccount;
  const grant: PermissionGrant = {
    ...fakeGrant,
    revokedAt: scenario === "revoked" ? "2026-09-15T00:00:00Z" : null,
    validUntil: scenario === "expired" ? "2026-09-15T00:00:00Z" : null,
    scopeKey: scenario === "other-scope" ? "crm:carteira-b" : fakeGrant.scopeKey,
  };

  return canAccess({
    verifiedUserId: scenario === "anonymous" ? null : subject,
    account,
    grants: [grant],
    capability: "crm.read",
    scopeKind: "resource",
    scopeKey: "crm:carteira-a",
    now: new Date("2026-10-25T12:00:00Z"),
  });
}

export function SecurityDemo() {
  const [scenario, setScenario] = useState<Scenario>("anonymous");
  const allowed = evaluateScenario(scenario);
  const selected = scenarios.find((item) => item.id === scenario)!;

  return (
    <HubShell>
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
        <div className="rounded-2xl border border-olive/30 bg-sage/25 p-5 text-sm text-forest">
          <strong>AMBIENTE 100% FICTÍCIO.</strong> Esta página não autentica,
          não concede privilégios, não escreve dados e não acessa o Supabase.
        </div>
        <div className="mt-12 flex flex-wrap items-start justify-between gap-7">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-olive">
              LEVIA HUB · HUB-04 · Demonstração provisória
            </p>
            <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">
              Laboratório de acesso
            </h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Compare situações de autenticação e permissão em um modelo isolado.
              A operação administrativa real continua protegida e indisponível
              até ser homologada no backend.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-5 py-3 text-sm font-semibold text-forest hover:bg-sage/20"
          >
            <LockKeyhole aria-hidden="true" className="size-4" />
            Login real (restrito)
          </Link>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <section className="rounded-2xl border border-border bg-card p-7">
            <h2 className="text-lg font-semibold text-forest">Cenário fictício</h2>
            <label htmlFor="scenario" className="mt-5 block text-sm font-medium">
              Selecionar cenário
            </label>
            <select
              id="scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value as Scenario)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm"
            >
              {scenarios.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              {selected.description}
            </p>
            <div className="mt-8 border-t border-border pt-6 text-sm">
              <p><strong>Capability:</strong> crm.read</p>
              <p className="mt-2"><strong>Escopo solicitado:</strong> crm:carteira-a</p>
              <p className="mt-2"><strong>Identidade:</strong> exclusivamente sintética</p>
            </div>
          </section>
          <section
            aria-live="polite"
            className="rounded-2xl border border-border bg-card p-7"
          >
            <div className="flex items-center gap-3">
              {allowed
                ? <CheckCircle2 aria-hidden="true" className="size-7 text-olive" />
                : <ShieldAlert aria-hidden="true" className="size-7 text-olive" />}
              <h2 className="text-lg font-semibold text-forest">Resultado do simulador</h2>
            </div>
            <p className="mt-8 font-serif text-3xl text-forest" data-testid="demo-result">
              {allowed ? "Permitido no cenário fictício" : "Acesso negado"}
            </p>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              {allowed
                ? "Apenas um exemplo isolado da regra de domínio, sem abrir qualquer rota protegida."
                : "Na ausência de uma condição válida, a decisão padrão é negar."}
            </p>
            <div className="mt-8 flex items-start gap-3 rounded-xl bg-sage/20 p-5 text-sm text-forest">
              <ShieldCheck aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <p>O resultado acima não é autorização de backend, não altera o banco
                e não habilita acesso administrativo real.</p>
            </div>
          </section>
        </div>
        <Link to="/" className="mt-9 inline-flex items-center text-sm font-semibold text-olive">
          Voltar à apresentação
        </Link>
      </div>
    </HubShell>
  );
}
