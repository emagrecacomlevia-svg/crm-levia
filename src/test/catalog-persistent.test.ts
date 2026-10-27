import { describe, expect, it } from "vitest";
import {
  isCatalogCommand,
  selectedTableOn,
  type CatalogSnapshot,
} from "@/modules/core/catalog/persistent";

const empty: CatalogSnapshot = {
  items: [],
  versions: [],
  tables: [],
  prices: [],
  selections: [],
  campaigns: [],
  references: [],
  audit: [],
};
const active: CatalogSnapshot = {
  ...empty,
  tables: [
    {
      id: "v1",
      revision: 1,
      audience: "DEMO",
      currency: "BRL",
      validFrom: "2026-01-01",
      validUntil: "2027-01-01",
      terms: "Somente demonstração",
    },
    {
      id: "v2",
      revision: 2,
      audience: "DEMO",
      currency: "BRL",
      validFrom: "2026-10-01",
      validUntil: "2026-11-01",
      terms: "Somente demonstração",
    },
  ],
  selections: [
    {
      id: "s1",
      commercialVersionId: "v1",
      selectedOn: "2026-10-01",
      reason: "Primeira escolha fictícia válida",
      decisionOrder: 1,
      actor: "MOCK",
    },
    {
      id: "s2",
      commercialVersionId: "v2",
      selectedOn: "2026-10-27",
      reason: "Segunda escolha fictícia válida",
      decisionOrder: 2,
      actor: "MOCK",
    },
  ],
};

describe("HUB-05 persistent catalog contracts", () => {
  it("rejects every non-whitelisted operation or oversized payload", () => {
    expect(isCatalogCommand({ action: "drop-table" })).toBe(false);
    expect(isCatalogCommand({ action: "snapshot" })).toBe(false);
    expect(isCatalogCommand({ action: "create-item", sku: "x".repeat(501) })).toBe(false);
    expect(isCatalogCommand({ action: "create-item", x: { privileged: true } })).toBe(false);
  });
  it("accepts only explicitly listed command envelopes before backend revalidation", () => {
    expect(isCatalogCommand({ action: "create-item", sku: "DEMO-TESTE" })).toBe(true);
    expect(isCatalogCommand({ action: "create-campaign", name: "DEMO" })).toBe(true);
  });
  it("does not auto-select a valid but undecided table", () => {
    expect(selectedTableOn({ ...active, selections: [] }, "2026-10-27")).toBeNull();
  });
  it("never resurrects historical tables when the latest choice expires", () => {
    expect(selectedTableOn(active, "2026-10-31")?.id).toBe("v2");
    expect(selectedTableOn(active, "2026-11-01")).toBeNull();
    expect(selectedTableOn(active, "2026-12-01")).toBeNull();
  });
  it("does not apply decisions to days before they were made", () => {
    expect(selectedTableOn(active, "2026-10-26")).toBeNull();
  });
});
