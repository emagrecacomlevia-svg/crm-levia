// Real backend response from hub-catalog: no DEMO fixture is used for persistence.
export type CatalogCommand = {
  action:
    | "create-item"
    | "create-version"
    | "create-table"
    | "add-price"
    | "select-table"
    | "create-campaign"
    | "link-campaign";
  [key: string]: string | number;
};

export type CatalogSnapshot = {
  items: { id: string; sku: string }[];
  versions: { id: string; itemId: string; revision: number; name: string; presentation: string; segment: string; documentRef: string }[];
  tables: { id: string; revision: number; audience: string; currency: string; validFrom: string; validUntil: string; terms: string }[];
  prices: { id: string; commercialVersionId: string; catalogVersionId: string; amountMinor: number }[];
  selections: { id: string; commercialVersionId: string; selectedOn: string; reason: string; decisionOrder: number; actor: string | null }[];
  campaigns: { id: string; code: string; name: string; purpose: string; channel: string; startsOn: string; endsOn: string; utmCampaign: string }[];
  references: { campaignId: string; commercialVersionId: string; catalogVersionId: string }[];
  audit: { id: string; entity: string; objectId: string; recordedAt: string; actor: string | null; sessionId: string | null }[];
};

export function isCatalogCommand(value: unknown): value is CatalogCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const allowed = ["create-item", "create-version", "create-table", "add-price", "select-table", "create-campaign", "link-campaign"];
  if (!allowed.includes(String(record["action"]))) return false;
  if (JSON.stringify(record).length > 7000 || Object.keys(record).length > 16) return false;
  return Object.values(record).every(
    (field) => (typeof field === "string" && field.length <= 500) ||
      (typeof field === "number" && Number.isSafeInteger(field)),
  );
}

export function selectedTableOn(snapshot: CatalogSnapshot, date: string) {
  const last = snapshot.selections.at(-1);
  if (!last || last.selectedOn > date) return null;
  const version = snapshot.tables.find((t) => t.id === last.commercialVersionId);
  return version && version.validFrom <= date && date < version.validUntil ? version : null;
}
