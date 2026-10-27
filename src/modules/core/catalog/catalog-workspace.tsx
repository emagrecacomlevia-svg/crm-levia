import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, History, Megaphone, ShieldCheck } from "lucide-react";

import { checkCapabilityFn } from "@/modules/identity/auth.functions";
import { getCatalogSnapshotFn, writeCatalogFn } from "./catalog.functions";
import {
  selectedTableOn,
  type CatalogCommand,
  type CatalogSnapshot,
} from "./persistent";

type Source = "items" | "versions" | "tables" | "campaigns";
type Input = { name: string; label: string; kind?: "date" | "number" | "select"; source?: Source; placeholder?: string };
type Operation = { action: CatalogCommand["action"]; name: string; fields: readonly Input[] };
const ops: readonly Operation[] = [
  { action: "create-item", name: "Novo item referencial", fields: [
    { name: "sku", label: "SKU fictício", placeholder: "DEMO-NOVO-001" },
  ] },
  { action: "create-version", name: "Nova versão de catálogo", fields: [
    { name: "itemId", label: "Item", kind: "select", source: "items" },
    { name: "name", label: "Nome referencial", placeholder: "Referência fictícia" },
    { name: "presentation", label: "Apresentação" },
    { name: "segment", label: "Segmento" },
    { name: "documentRef", label: "Referência documental" },
  ] },
  { action: "create-table", name: "Nova tabela comercial", fields: [
    { name: "audience", label: "Público" },
    { name: "validFrom", label: "Início da vigência", kind: "date" },
    { name: "validUntil", label: "Término exclusivo", kind: "date" },
    { name: "terms", label: "Condições fictícias" },
  ] },
  { action: "add-price", name: "Adicionar preço em centavos", fields: [
    { name: "commercialVersionId", label: "Tabela ainda não selada", kind: "select", source: "tables" },
    { name: "catalogVersionId", label: "Versão de catálogo", kind: "select", source: "versions" },
    { name: "amountMinor", label: "Preço fictício (centavos)", kind: "number" },
  ] },
  { action: "select-table", name: "Registrar decisão de vigência", fields: [
    { name: "commercialVersionId", label: "Tabela com preços", kind: "select", source: "tables" },
    { name: "selectedOn", label: "Data da decisão", kind: "date" },
    { name: "reason", label: "Justificativa (15 a 500 caracteres)" },
  ] },
  { action: "create-campaign", name: "Nova campanha", fields: [
    { name: "code", label: "Código fictício", placeholder: "DEMO-CAMPANHA-001" },
    { name: "name", label: "Nome da campanha" },
    { name: "purpose", label: "Finalidade" },
    { name: "channel", label: "Canal: interno, instagram, facebook ou tiktok", placeholder: "interno" },
    { name: "startsOn", label: "Início", kind: "date" },
    { name: "endsOn", label: "Fim exclusivo", kind: "date" },
    { name: "utmCampaign", label: "UTM fictício", placeholder: "demo-campanha-001" },
  ] },
  { action: "link-campaign", name: "Vincular campanha a preço histórico", fields: [
    { name: "campaignId", label: "Campanha", kind: "select", source: "campaigns" },
    { name: "commercialVersionId", label: "Tabela", kind: "select", source: "tables" },
    { name: "catalogVersionId", label: "Versão do catálogo presente na tabela", kind: "select", source: "versions" },
  ] },
];
const style = "mt-2 block w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm";
const card = "rounded-2xl border border-border bg-card p-5 sm:p-7";
const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);

function choices(snapshot: CatalogSnapshot, kind: Source) {
  if (kind === "items") return snapshot.items.map((x) => ({ id: x.id, text: x.sku }));
  if (kind === "versions") return snapshot.versions.map((x) => ({
    id: x.id, text: x.name + " · v" + x.revision,
  }));
  if (kind === "tables") return snapshot.tables.map((x) => ({
    id: x.id, text: "Tabela v" + x.revision + " · " + x.audience,
  }));
  return snapshot.campaigns.map((x) => ({ id: x.id, text: x.code }));
}

export function CatalogWorkspace() {
  const [data, setData] = useState<CatalogSnapshot | null>(null);
  const [writable, setWritable] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let live = true;
    void Promise.all([
      getCatalogSnapshotFn(),
      checkCapabilityFn({ data: {
        capability: "catalog.write", scopeKind: "module", scopeKey: "catalog",
      } }),
    ]).then(([result, access]) => {
      if (!live) return;
      if (result.ok && "snapshot" in result) setData(result.snapshot);
      else if (!result.ok) { setError(true); setMessage(result.message); }
      setWritable(access.state === "authorized");
      setBusy(false);
    }).catch(() => {
      if (!live) return;
      setError(true); setMessage("Não foi possível consultar o catálogo.");
      setBusy(false);
    });
    return () => { live = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>, action: CatalogCommand["action"]) {
    event.preventDefault();
    if (busy || !writable) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    const command: CatalogCommand = { action };
    for (const [key, value] of Object.entries(fields)) {
      command[key] = key === "amountMinor" ? Number(value) : String(value).trim();
    }
    setBusy(true); setMessage("");
    try {
      const result = await writeCatalogFn({ data: command });
      if (!result.ok) { setMessage(result.message); setError(true); return; }
      const refreshed = await getCatalogSnapshotFn();
      if (!refreshed.ok || !("snapshot" in refreshed)) {
        setMessage("Gravação confirmada. Atualize a página para consultar o histórico.");
        setError(false);
        return;
      }
      setData(refreshed.snapshot);
      setError(false); setMessage("Gravação auditada confirmada pelo backend.");
      event.currentTarget.reset();
    } catch {
      setError(true); setMessage("A gravação não pôde ser confirmada.");
    } finally { setBusy(false); }
  }

  const current = data ? selectedTableOn(data, day) : null;
  const latest = data?.selections.at(-1);
  const titleOf = (id: string) => data?.versions.find((v) => v.id === id)?.name ?? "Versão não localizada";
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-olive">LEVIA HUB · HUB-05 · Área autenticada</p>
        <h1 className="font-serif text-4xl text-forest">Catálogo e Campanhas</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          Persistência no Supabase de desenvolvimento. Registros históricos são imutáveis,
          alterações exigem permissão específica e gravações produzem eventos auditáveis.
        </p>
        <div className="rounded-xl border border-olive/20 bg-sage/20 p-4 text-sm text-forest">
          <ShieldCheck aria-hidden="true" className="mr-2 inline size-4" />
          Os códigos DEMO representam registros fictícios persistidos — não ofertas comerciais.
          A rota pública de simulação permanece separada.
        </div>
        {!writable && !busy && <p className="text-sm text-olive">
          Acesso somente leitura. Para gravar é necessário catalog.write no escopo catalog.
        </p>}
      </header>
      {message && <p role={error ? "alert" : "status"} className="rounded-xl border border-border p-4 text-sm">{message}</p>}
      {busy && <p role="status" className="text-sm text-muted-foreground">Sincronizando com o banco...</p>}
      {data && (
        <>
          <section className={card}>
            <label className="block text-sm font-semibold">Consultar vigência em uma data
              <input className={style} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
            <h2 className="mt-4 font-serif text-2xl text-forest" data-testid="catalog-current">
              {current ? "Tabela v" + current.revision + " vigente" : "Sem tabela vigente"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A última decisão registrada prevalece. O vencimento nunca restaura uma tabela anterior.
            </p>
          </section>
          <section className={card}>
            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold"><BookOpen className="size-5" /> Referências e versões</h2>
            {data.items.length === 0 && <p className="text-sm">Nenhum item cadastrado.</p>}
            {data.items.map((item) => <div key={item.id} className="border-t border-border py-4">
              <strong>{item.sku}</strong>
              {data.versions.filter((v) => v.itemId === item.id).map((v) => (
                <p key={v.id} className="mt-2 text-sm">{v.name} · v{v.revision} · {v.presentation} · {v.segment} · {v.documentRef}</p>
              ))}
            </div>)}
          </section>
          <section className={card}>
            <h2 className="mb-5 text-xl font-semibold">Tabelas comerciais e preços fictícios</h2>
            {data.tables.length === 0 && <p className="text-sm">Nenhuma tabela criada.</p>}
            {data.tables.map((t) => <article key={t.id} className="border-t border-border py-4">
              <h3 className="font-semibold">Tabela v{t.revision} · {t.audience}</h3>
              <p className="text-xs text-muted-foreground">{t.validFrom} até {t.validUntil} (exclusivo) · {t.terms}</p>
              {data.prices.filter((p) => p.commercialVersionId === t.id).map((p) =>
                <p key={p.id} className="mt-2 text-sm">{titleOf(p.catalogVersionId)} · {money(p.amountMinor)} (fictícios)</p>)}
            </article>)}
          </section>
          <section className={card}>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Megaphone className="size-5" /> Campanhas e referências</h2>
            {data.campaigns.length === 0 && <p className="text-sm">Nenhuma campanha criada.</p>}
            {data.campaigns.map((campaign) => <article key={campaign.id} className="border-t border-border py-4">
              <h3 className="font-semibold">{campaign.code} · {campaign.name}</h3>
              <p className="text-sm">{campaign.channel} · {campaign.startsOn} a {campaign.endsOn} · {campaign.utmCampaign}</p>
              {data.references.filter((ref) => ref.campaignId === campaign.id).map((ref) =>
                <p key={ref.commercialVersionId + ref.catalogVersionId} className="text-xs text-muted-foreground">
                  {titleOf(ref.catalogVersionId)} · tabela v{data.tables.find((t) => t.id === ref.commercialVersionId)?.revision ?? "?"}
                </p>)}
            </article>)}
          </section>
          <section className={card}>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><History className="size-5" /> Histórico e auditoria</h2>
            <p className="text-sm">Última decisão: {latest ? latest.selectedOn + " · " + latest.reason : "nenhuma"}</p>
            {data.selections.map((s) => <p key={s.id} className="mt-2 border-t border-border pt-2 text-sm">
              Ordem {s.decisionOrder} · {s.selectedOn} · {s.reason} · ator {s.actor ?? "legado"}
            </p>)}
            <h3 className="mt-5 font-semibold">Eventos persistidos</h3>
            <p className="text-xs text-muted-foreground">Até 500 eventos recentes, somente leitura.</p>
            {data.audit.slice(0, 30).map((a) => <p key={a.id} className="mt-2 break-all text-xs">
              {a.recordedAt} · {a.entity} · ator {a.actor ?? "legado"}
            </p>)}
          </section>
          {writable && <section className={card}>
            <h2 className="mb-5 text-xl font-semibold">Operações com histórico preservado</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              {ops.map((op) => <details key={op.action} className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">{op.name}</summary>
                <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event, op.action)}>
                  {op.fields.map((field) => <label key={field.name} className="block text-sm font-medium">
                    {field.label}
                    {field.kind === "select" && field.source ? (
                      <select name={field.name} required className={style}>
                        <option value="">Selecionar</option>
                        {choices(data, field.source).map((option) =>
                          <option key={option.id} value={option.id}>{option.text}</option>)}
                      </select>
                    ) : (
                      <input name={field.name} required className={style}
                        type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"}
                        min={field.kind === "number" ? 1 : undefined}
                        maxLength={field.kind === "number" ? undefined : 500}
                        placeholder={field.placeholder} />
                    )}
                  </label>)}
                  <button type="submit" disabled={busy}
                    className="rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    Registrar no Supabase
                  </button>
                </form>
              </details>)}
            </div>
          </section>}
        </>
      )}
    </div>
  );
}
