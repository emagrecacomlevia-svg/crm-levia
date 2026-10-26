import { cloneElement, useId, useState, type FormEvent, type ReactElement } from "react";
import { BookOpen, History, Megaphone, RotateCcw } from "lucide-react";

import { createCatalogFixture } from "./fixture";
import {
  addCampaign,
  addCatalogVersion,
  addCommercialVersion,
  currentCommercialVersion,
  formatAmount,
  linkCampaign,
  parseAmount,
  selectCommercialVersion,
  type Campaign,
  type CatalogState,
} from "./model";

const inputClass = "mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive";
const cardClass = "min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-7";

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className="text-sm font-medium text-forest">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}

export function CatalogDemo() {
  const [state, setState] = useState(createCatalogFixture);
  const [day, setDay] = useState("2026-10-26");
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [linkTable, setLinkTable] = useState("commercial-1");
  const current = currentCommercialVersion(state, day);
  const selectedTable = state.commercialVersions.find((v) => v.id === linkTable);

  function update(change: (s: CatalogState) => CatalogState, message: string) {
    try {
      setState(change(state));
      setFeedback({ text: message, error: false });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : "Não foi possível concluir.",
        error: true,
      });
    }
  }
  function form(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    return (key: string) => String(data.get(key) ?? "");
  }
  function reset() {
    setState(createCatalogFixture());
    setDay("2026-10-26");
    setLinkTable("commercial-1");
    setFeedback({ text: "Exemplos restaurados. Nenhuma tabela está selecionada.", error: false });
  }
  const titleOf = (id: string) => {
    const v = state.catalogVersions.find((entry) => entry.id === id);
    return v ? `${v.name} · catálogo v${v.revision}` : "Referência indisponível";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-9 px-5 py-10 sm:px-8 lg:py-14">
      <div className="rounded-xl border border-olive/30 bg-sage/25 p-4 text-sm leading-6 text-forest">
        <strong>DADOS 100% FICTÍCIOS.</strong> Preços sem validade comercial. As alterações duram
        somente nesta página e são descartadas ao recarregar. Use apenas exemplos inventados.
      </div>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-olive">
            LEVIA HUB · HUB-05 · Laboratório
          </p>
          <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">Catálogo e campanhas</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Organize referências, compare versões e mantenha cada campanha ligada ao histórico que
            foi escolhido.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-forest hover:bg-sage/20"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Reiniciar exemplos
        </button>
      </header>
      <nav
        aria-label="Seções do laboratório"
        className="flex flex-wrap gap-3 text-sm font-semibold text-forest"
      >
        {[
          ["#catalogo", "Catálogo"],
          ["#tabelas", "Tabelas e vigência"],
          ["#campanhas", "Campanhas"],
          ["#historico", "Histórico de seleção"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-border px-4 py-2 hover:bg-sage/30"
          >
            {label}
          </a>
        ))}
      </nav>
      {feedback && (
        <div
          role={feedback.error ? "alert" : "status"}
          className={`rounded-xl border p-4 text-sm ${feedback.error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-olive/30 bg-sage/20 text-forest"}`}
        >
          {feedback.text}
        </div>
      )}
      <section
        aria-label="Vigência simulada"
        className="grid gap-6 rounded-2xl bg-forest p-6 text-white sm:grid-cols-[1fr_240px] sm:p-8"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sage">
            Consulta simulada
          </p>
          <h2 data-testid="current-table" className="mt-3 font-serif text-2xl sm:text-3xl">
            {current ? `Tabela v${current.revision} selecionada` : "Sem tabela vigente nesta data"}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
            Uma data compatível não seleciona uma tabela. Após o vencimento, uma versão anterior não
            volta a vigorar automaticamente.
          </p>
        </div>
        <label className="self-center text-sm font-medium">
          Data de consulta
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-white/30 bg-white px-3 py-3 text-forest"
          />
        </label>
      </section>

      <section id="catalogo" className="scroll-mt-5 space-y-5">
        <h2 className="flex items-center gap-3 text-2xl font-semibold text-forest">
          <BookOpen aria-hidden="true" className="size-6" />
          Catálogo referencial
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {state.items.map((item) => (
            <article key={item.id} className={cardClass}>
              <p className="text-xs font-bold tracking-widest text-olive">{item.sku}</p>
              <ol className="mt-4 space-y-4">
                {state.catalogVersions
                  .filter((v) => v.itemId === item.id)
                  .map((v) => (
                    <li key={v.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold text-forest">{v.name}</h3>
                        <span className="rounded-full bg-sage/30 px-3 py-1 text-xs font-semibold">
                          v{v.revision}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {v.presentation} · {v.segment}
                      </p>
                      <p className="mt-2 break-words text-xs text-muted-foreground">
                        Referência: {v.documentRef}
                      </p>
                    </li>
                  ))}
              </ol>
            </article>
          ))}
        </div>
        <details className={cardClass}>
          <summary className="cursor-pointer text-base font-semibold text-forest">
            Criar versão de catálogo
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            A nova versão preserva as anteriores. Tabelas e campanhas existentes mantêm suas
            referências.
          </p>
          <form
            method="post"
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              const v = form(event);
              update(
                (s) =>
                  addCatalogVersion(s, {
                    id: crypto.randomUUID(),
                    itemId: v("item"),
                    name: v("name"),
                    presentation: v("presentation"),
                    segment: v("segment"),
                    documentRef: v("document"),
                  }),
                "Nova versão de catálogo criada. O histórico e os vínculos foram preservados.",
              );
            }}
          >
            <Field label="Item de catálogo">
              <select name="item" className={inputClass}>
                {state.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nome fictício">
              <input name="name" required maxLength={160} className={inputClass} />
            </Field>
            <Field label="Apresentação">
              <input name="presentation" required maxLength={160} className={inputClass} />
            </Field>
            <Field label="Segmento">
              <input name="segment" required maxLength={160} className={inputClass} />
            </Field>
            <Field label="Referência documental fictícia">
              <input
                name="document"
                required
                maxLength={160}
                placeholder="DEMO-DOC-003"
                className={inputClass}
              />
            </Field>
            <div className="self-end">
              <button type="submit" className={buttonClass}>
                Criar versão
              </button>
            </div>
          </form>
        </details>
      </section>

      <section id="tabelas" className="scroll-mt-5 space-y-5">
        <h2 className="text-2xl font-semibold text-forest">Tabelas demonstrativas e vigência</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          O início é inclusivo e o término é exclusivo. Os valores abaixo são inventados e não
          representam ofertas.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {state.commercialVersions.map((v) => (
            <article key={v.id} className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-forest">Tabela v{v.revision}</h3>
                <span className="rounded-full bg-sage/30 px-3 py-1 text-xs font-semibold">
                  {current?.id === v.id ? "Selecionada na simulação" : "Versão preservada"}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {v.audience} · {v.validFrom} até {v.validUntil}
              </p>
              <ul className="mt-5 divide-y divide-border">
                {v.prices.map((p) => (
                  <li
                    key={p.catalogVersionId}
                    className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                  >
                    <span>{titleOf(p.catalogVersionId)}</span>
                    <strong className="whitespace-nowrap text-forest">
                      {formatAmount(p.amountMinor)} <span className="font-normal">fictícios</span>
                    </strong>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{v.terms}</p>
            </article>
          ))}
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <details className={cardClass}>
            <summary className="cursor-pointer font-semibold text-forest">
              Criar tabela demonstrativa
            </summary>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Cria uma nova tabela com um item escolhido. Ela não será selecionada automaticamente.
            </p>
            <form
              method="post"
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                const v = form(event);
                update(
                  (s) =>
                    addCommercialVersion(s, {
                      id: crypto.randomUUID(),
                      audience: v("audience"),
                      validFrom: v("from"),
                      validUntil: v("until"),
                      terms: v("terms"),
                      prices: [
                        { catalogVersionId: v("catalog"), amountMinor: parseAmount(v("amount")) },
                      ],
                    }),
                  "Tabela criada sem seleção automática.",
                );
              }}
            >
              <Field label="Versão do item">
                <select name="catalog" className={inputClass}>
                  {state.catalogVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {titleOf(v.id)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preço fictício (R$)">
                  <input
                    name="amount"
                    inputMode="decimal"
                    required
                    placeholder="149,90"
                    className={inputClass}
                  />
                </Field>
                <Field label="Público fictício">
                  <input
                    name="audience"
                    required
                    maxLength={160}
                    defaultValue="Público fictício"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Início da tabela">
                  <input
                    name="from"
                    type="date"
                    required
                    defaultValue="2026-10-01"
                    className={inputClass}
                  />
                </Field>
                <Field label="Término da tabela">
                  <input
                    name="until"
                    type="date"
                    required
                    defaultValue="2026-12-01"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Condições fictícias">
                <input
                  name="terms"
                  required
                  minLength={5}
                  maxLength={500}
                  defaultValue="Exemplo sem validade comercial."
                  className={inputClass}
                />
              </Field>
              <button type="submit" className={buttonClass}>
                Criar tabela
              </button>
            </form>
          </details>
          <section className={cardClass}>
            <h3 className="font-semibold text-forest">Selecionar vigência na simulação</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Escolha uma versão e registre o motivo. A decisão vale apenas neste laboratório, na
              data de consulta.
            </p>
            <form
              method="post"
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                const v = form(event);
                update(
                  (s) =>
                    selectCommercialVersion(s, {
                      id: crypto.randomUUID(),
                      commercialVersionId: v("table"),
                      selectedOn: day,
                      reason: v("reason"),
                    }),
                  "Seleção fictícia registrada no histórico.",
                );
              }}
            >
              <Field label="Tabela a selecionar">
                <select name="table" className={inputClass}>
                  {state.commercialVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Tabela v{v.revision}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo da seleção">
                <textarea
                  name="reason"
                  required
                  minLength={15}
                  maxLength={500}
                  rows={2}
                  className={inputClass}
                />
              </Field>
              <button type="submit" className={buttonClass}>
                Registrar seleção fictícia
              </button>
            </form>
          </section>
        </div>
      </section>

      <section id="campanhas" className="scroll-mt-5 space-y-5">
        <h2 className="flex items-center gap-3 text-2xl font-semibold text-forest">
          <Megaphone aria-hidden="true" className="size-6" />
          Campanhas e referências
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Identificadores e metadados de planejamento. Cada vínculo aponta para versões exatas e
          permanece no histórico.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {state.campaigns.map((campaign) => (
            <article key={campaign.id} className={cardClass}>
              <p className="text-xs font-bold tracking-wider text-olive">
                {campaign.code} · RASCUNHO FICTÍCIO
              </p>
              <h3 className="mt-3 text-lg font-semibold text-forest">{campaign.name}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{campaign.purpose}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {campaign.channel} · {campaign.startsOn} até {campaign.endsOn}
              </p>
              <p className="mt-2 break-words text-xs text-muted-foreground">
                UTM: {campaign.utmCampaign}
              </p>
              <ul className="mt-5 space-y-3">
                {state.references
                  .filter((r) => r.campaignId === campaign.id)
                  .map((r) => {
                    const table = state.commercialVersions.find(
                      (v) => v.id === r.commercialVersionId,
                    )!;
                    const price = table.prices.find(
                      (p) => p.catalogVersionId === r.catalogVersionId,
                    )!;
                    return (
                      <li
                        key={`${r.commercialVersionId}:${r.catalogVersionId}`}
                        className="rounded-lg bg-sage/20 p-3 text-sm text-forest"
                      >
                        {titleOf(r.catalogVersionId)}
                        <br />
                        <strong>
                          Tabela v{table.revision} · {formatAmount(price.amountMinor)} fictícios
                        </strong>
                        <p className="mt-1 text-xs">
                          Referência histórica fixa; não representa vigência ou aprovação.
                        </p>
                      </li>
                    );
                  })}
              </ul>
              {!state.references.some((r) => r.campaignId === campaign.id) && (
                <p className="mt-4 text-sm text-muted-foreground">Nenhuma referência vinculada.</p>
              )}
            </article>
          ))}
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <details className={cardClass}>
            <summary className="cursor-pointer font-semibold text-forest">
              Criar campanha fictícia
            </summary>
            <form
              method="post"
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                const v = form(event);
                update(
                  (s) =>
                    addCampaign(s, {
                      id: crypto.randomUUID(),
                      code: v("code"),
                      name: v("name"),
                      purpose: v("purpose"),
                      channel: v("channel") as Campaign["channel"],
                      startsOn: v("from"),
                      endsOn: v("until"),
                      utmCampaign: v("utm"),
                    }),
                  "Campanha fictícia criada, sem publicação externa.",
                );
              }}
            >
              <Field label="Código da campanha">
                <input
                  name="code"
                  required
                  maxLength={40}
                  placeholder="DEMO-NOVEMBRO"
                  className={inputClass}
                />
              </Field>
              <Field label="Nome da campanha">
                <input name="name" required maxLength={160} className={inputClass} />
              </Field>
              <Field label="Finalidade">
                <input
                  name="purpose"
                  required
                  minLength={5}
                  maxLength={500}
                  className={inputClass}
                />
              </Field>
              <Field label="Canal">
                <select name="channel" className={inputClass}>
                  {["interno", "instagram", "facebook", "tiktok"].map((channel) => (
                    <option key={channel}>{channel}</option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Início da campanha">
                  <input
                    name="from"
                    required
                    type="date"
                    defaultValue="2026-11-01"
                    className={inputClass}
                  />
                </Field>
                <Field label="Término da campanha">
                  <input
                    name="until"
                    required
                    type="date"
                    defaultValue="2026-12-01"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Identificador UTM">
                <input
                  name="utm"
                  required
                  maxLength={65}
                  placeholder="demo-novembro"
                  className={inputClass}
                />
              </Field>
              <button type="submit" className={buttonClass}>
                Criar campanha
              </button>
            </form>
          </details>
          <details className={cardClass}>
            <summary className="cursor-pointer font-semibold text-forest">
              Vincular referência a campanha
            </summary>
            <form
              method="post"
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                const v = form(event);
                update(
                  (s) =>
                    linkCampaign(s, {
                      campaignId: v("campaign"),
                      commercialVersionId: linkTable,
                      catalogVersionId: v("catalog"),
                    }),
                  "Referência fixa vinculada à campanha.",
                );
              }}
            >
              <Field label="Campanha">
                <select name="campaign" className={inputClass}>
                  {state.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tabela de referência">
                <select
                  value={linkTable}
                  onChange={(e) => setLinkTable(e.target.value)}
                  className={inputClass}
                >
                  {state.commercialVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Tabela v{v.revision}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Item de referência">
                <select key={linkTable} name="catalog" className={inputClass}>
                  {selectedTable?.prices.map((p) => (
                    <option key={p.catalogVersionId} value={p.catalogVersionId}>
                      {titleOf(p.catalogVersionId)}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className={buttonClass}>
                Vincular referência
              </button>
            </form>
          </details>
        </div>
      </section>
      <section id="historico" className={`${cardClass} scroll-mt-5`}>
        <h2 className="flex items-center gap-3 text-xl font-semibold text-forest">
          <History aria-hidden="true" className="size-5" />
          Histórico de seleção
        </h2>
        {!state.selections.length ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma decisão registrada. As versões existentes permanecem sem vigência selecionada.
          </p>
        ) : (
          <ol className="mt-5 space-y-3">
            {state.selections.map((s) => (
              <li key={s.id} className="rounded-lg border border-border p-4 text-sm">
                <strong>
                  Tabela v
                  {state.commercialVersions.find((v) => v.id === s.commercialVersionId)?.revision} ·{" "}
                  {s.selectedOn}
                </strong>
                <p className="mt-2 break-words">{s.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Responsável: operador fictício · decisão de simulação
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <a href="/" className="inline-flex py-3 text-sm font-semibold text-olive">
        Voltar ao LEVIA HUB
      </a>
    </div>
  );
}
