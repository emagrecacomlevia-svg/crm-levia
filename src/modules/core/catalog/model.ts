// Isolated HUB-05 domain. No Auth, network, storage or real commercial data.
export type CatalogItem = { id: string; sku: string };
export type CatalogVersion = {
  id: string;
  itemId: string;
  revision: number;
  name: string;
  presentation: string;
  segment: string;
  documentRef: string;
};
export type PriceLine = { catalogVersionId: string; amountMinor: number };
export type CommercialVersion = {
  id: string;
  revision: number;
  audience: string;
  currency: "BRL";
  validFrom: string;
  validUntil: string;
  terms: string;
  prices: readonly PriceLine[];
};
export type Selection = {
  id: string;
  commercialVersionId: string;
  selectedOn: string;
  reason: string;
  actor: "OPERADOR-FICTICIO";
};
export type Campaign = {
  id: string;
  code: string;
  name: string;
  purpose: string;
  channel: "instagram" | "facebook" | "tiktok" | "interno";
  startsOn: string;
  endsOn: string;
  utmCampaign: string;
};
export type CampaignReference = {
  campaignId: string;
  commercialVersionId: string;
  catalogVersionId: string;
};
export type CatalogState = {
  items: readonly CatalogItem[];
  catalogVersions: readonly CatalogVersion[];
  commercialVersions: readonly CommercialVersion[];
  selections: readonly Selection[];
  campaigns: readonly Campaign[];
  references: readonly CampaignReference[];
};

function required(value: string, label: string, min = 1, max = 160): string {
  const result = value.trim();
  if (result.length < min || result.length > max)
    throw new Error(`${label}: informe entre ${min} e ${max} caracteres.`);
  return result;
}

export function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function period(start: string, end: string) {
  if (!validDay(start) || !validDay(end) || start >= end)
    throw new Error("Informe um período válido, com fim posterior ao início.");
}

export function parseAmount(value: string): number {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Informe um preço fictício positivo com até duas casas decimais.");
  const [units = "0", decimals = ""] = value.trim().replace(",", ".").split(".");
  const amount = Number(units) * 100 + Number(decimals.padEnd(2, "0"));
  if (amount <= 0) throw new Error("O preço fictício deve ser maior que zero.");
  return amount;
}

export function formatAmount(amountMinor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    amountMinor / 100,
  );
}

export function addCatalogVersion(
  state: CatalogState,
  input: Omit<CatalogVersion, "revision">,
): CatalogState {
  if (!state.items.some((item) => item.id === input.itemId)) throw new Error("Item inexistente.");
  if (state.catalogVersions.some((version) => version.id === input.id))
    throw new Error("Identificador de versão já utilizado.");
  const version: CatalogVersion = {
    ...input,
    revision:
      1 +
      Math.max(
        0,
        ...state.catalogVersions.filter((v) => v.itemId === input.itemId).map((v) => v.revision),
      ),
    name: required(input.name, "Nome"),
    presentation: required(input.presentation, "Apresentação"),
    segment: required(input.segment, "Segmento"),
    documentRef: required(input.documentRef, "Referência documental"),
  };
  return { ...state, catalogVersions: [...state.catalogVersions, version] };
}

export function addCommercialVersion(
  state: CatalogState,
  input: Omit<CommercialVersion, "revision" | "currency">,
): CatalogState {
  period(input.validFrom, input.validUntil);
  if (state.commercialVersions.some((v) => v.id === input.id))
    throw new Error("Tabela já existente.");
  if (!input.prices.length) throw new Error("Inclua ao menos um item de preço.");
  const items = new Set<string>();
  const prices = input.prices.map((line) => {
    const version = state.catalogVersions.find((v) => v.id === line.catalogVersionId);
    if (!version) throw new Error("Versão de catálogo inexistente.");
    if (items.has(version.itemId)) throw new Error("Cada item pode aparecer uma vez por tabela.");
    items.add(version.itemId);
    if (
      !Number.isSafeInteger(line.amountMinor) ||
      line.amountMinor <= 0 ||
      line.amountMinor > 999999999
    )
      throw new Error("Preço fictício inválido.");
    return { ...line };
  });
  const version: CommercialVersion = {
    ...input,
    audience: required(input.audience, "Público"),
    terms: required(input.terms, "Condições", 5, 500),
    currency: "BRL",
    revision: 1 + Math.max(0, ...state.commercialVersions.map((v) => v.revision)),
    prices,
  };
  return { ...state, commercialVersions: [...state.commercialVersions, version] };
}

// The last explicit decision is authoritative. Expiry never revives an older table.
export function currentCommercialVersion(
  state: CatalogState,
  day: string,
): CommercialVersion | null {
  if (!validDay(day)) return null;
  const decision = state.selections.at(-1);
  if (!decision || decision.selectedOn > day) return null;
  const version = state.commercialVersions.find((v) => v.id === decision.commercialVersionId);
  return version && version.validFrom <= day && day < version.validUntil ? version : null;
}

export function selectCommercialVersion(
  state: CatalogState,
  input: Omit<Selection, "actor">,
): CatalogState {
  const version = state.commercialVersions.find((v) => v.id === input.commercialVersionId);
  if (
    !version ||
    !validDay(input.selectedOn) ||
    input.selectedOn < version.validFrom ||
    input.selectedOn >= version.validUntil
  )
    throw new Error("A tabela deve estar dentro da vigência na data da seleção.");
  const last = state.selections.at(-1);
  if (last && input.selectedOn < last.selectedOn)
    throw new Error("A seleção não pode retroceder no histórico.");
  if (state.selections.some((s) => s.id === input.id)) throw new Error("Decisão já existente.");
  return {
    ...state,
    selections: [
      ...state.selections,
      { ...input, reason: required(input.reason, "Motivo", 15, 500), actor: "OPERADOR-FICTICIO" },
    ],
  };
}

export function addCampaign(state: CatalogState, input: Campaign): CatalogState {
  period(input.startsOn, input.endsOn);
  const code = input.code.trim().toUpperCase();
  const utmCampaign = input.utmCampaign.trim().toLowerCase();
  if (!/^DEMO-[A-Z0-9-]{1,35}$/.test(code))
    throw new Error("Use um código DEMO- seguido de letras, números ou hífens.");
  if (!/^demo-[a-z0-9-]{1,60}$/.test(utmCampaign))
    throw new Error("O identificador UTM deve começar com demo-.");
  if (
    state.campaigns.some(
      (c) => c.id === input.id || c.code === code || c.utmCampaign === utmCampaign,
    )
  )
    throw new Error("Código ou identificador UTM já utilizado.");
  if (!["instagram", "facebook", "tiktok", "interno"].includes(input.channel))
    throw new Error("Canal inválido.");
  return {
    ...state,
    campaigns: [
      ...state.campaigns,
      {
        ...input,
        code,
        utmCampaign,
        name: required(input.name, "Nome"),
        purpose: required(input.purpose, "Finalidade", 5, 500),
      },
    ],
  };
}

export function linkCampaign(state: CatalogState, reference: CampaignReference): CatalogState {
  if (!state.campaigns.some((c) => c.id === reference.campaignId))
    throw new Error("Campanha inexistente.");
  const table = state.commercialVersions.find((v) => v.id === reference.commercialVersionId);
  if (!table?.prices.some((p) => p.catalogVersionId === reference.catalogVersionId))
    throw new Error("A versão de catálogo não pertence à tabela selecionada.");
  if (
    state.references.some(
      (r) =>
        r.campaignId === reference.campaignId &&
        r.commercialVersionId === reference.commercialVersionId &&
        r.catalogVersionId === reference.catalogVersionId,
    )
  )
    throw new Error("Referência já vinculada.");
  return { ...state, references: [...state.references, { ...reference }] };
}
