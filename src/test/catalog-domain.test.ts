import { describe, expect, it } from "vitest";
import { createCatalogFixture } from "@/modules/core/catalog/fixture";
import {
  addCampaign,
  addCatalogVersion,
  addCommercialVersion,
  currentCommercialVersion,
  linkCampaign,
  parseAmount,
  selectCommercialVersion,
  validDay,
} from "@/modules/core/catalog/model";

const reason = "Selecionada apenas para o ensaio fictício.";
const select = (id: string, commercialVersionId: string, selectedOn = "2026-10-26") => ({
  id,
  commercialVersionId,
  selectedOn,
  reason,
});

describe("HUB-05 history and explicit validity", () => {
  it("never selects a version merely because it is the latest or within its dates", () => {
    expect(currentCommercialVersion(createCatalogFixture(), "2026-10-26")).toBeNull();
  });
  it("keeps both decisions and never resurrects the older unexpired table", () => {
    let state = selectCommercialVersion(createCatalogFixture(), select("s1", "commercial-1"));
    state = selectCommercialVersion(state, select("s2", "commercial-2"));
    expect(state.selections).toHaveLength(2);
    expect(currentCommercialVersion(state, "2026-10-31")?.id).toBe("commercial-2");
    expect(currentCommercialVersion(state, "2026-11-01")).toBeNull();
    expect(currentCommercialVersion(state, "2026-12-01")).toBeNull();
  });
  it("uses inclusive start/exclusive end and requires a reason", () => {
    const state = createCatalogFixture();
    expect(
      selectCommercialVersion(state, select("s", "commercial-2", "2026-10-01")).selections,
    ).toHaveLength(1);
    expect(() => selectCommercialVersion(state, select("s", "commercial-2", "2026-11-01"))).toThrow(
      /vigência/,
    );
    expect(() =>
      selectCommercialVersion(state, { ...select("s", "commercial-1"), reason: "" }),
    ).toThrow(/Motivo/);
  });
  it("rejects backdated and duplicate selection decisions", () => {
    const state = selectCommercialVersion(createCatalogFixture(), select("s", "commercial-1"));
    expect(() =>
      selectCommercialVersion(state, select("s2", "commercial-1", "2026-10-25")),
    ).toThrow(/retroceder/);
    expect(() => selectCommercialVersion(state, select("s", "commercial-1"))).toThrow(/existente/);
    expect(currentCommercialVersion(state, "2026-10-25")).toBeNull();
  });
  it("a new catalog snapshot does not modify any existing table or campaign", () => {
    const original = createCatalogFixture();
    const snapshot = JSON.stringify(original);
    const state = addCatalogVersion(original, {
      ...original.catalogVersions[0]!,
      id: "alpha-new",
      name: "Outra apresentação fictícia",
    });
    expect(state.catalogVersions.at(-1)?.revision).toBe(2);
    expect(state.references[0]?.catalogVersionId).toBe("catalog-alpha-1");
    expect(state.commercialVersions[0]?.prices[0]?.catalogVersionId).toBe("catalog-alpha-1");
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it("rejects unknown items and versions with missing documentary metadata", () => {
    const state = createCatalogFixture();
    const v = state.catalogVersions[0]!;
    expect(() => addCatalogVersion(state, { ...v, id: "new", itemId: "missing" })).toThrow(
      /inexistente/,
    );
    expect(() => addCatalogVersion(state, { ...v, id: "new", documentRef: " " })).toThrow(
      /documental/,
    );
  });
  it("copies price inputs and requires valid, unique items with integer cents", () => {
    const state = createCatalogFixture();
    const base = { ...state.commercialVersions[0]!, id: "new" };
    const prices = [{ catalogVersionId: "catalog-alpha-1", amountMinor: 12345 }];
    const next = addCommercialVersion(state, { ...base, prices });
    prices[0]!.amountMinor = 1;
    expect(next.commercialVersions.at(-1)?.prices[0]?.amountMinor).toBe(12345);
    expect(currentCommercialVersion(next, "2026-10-26")).toBeNull();
    for (const invalid of [
      [],
      [{ catalogVersionId: "missing", amountMinor: 10 }],
      [{ catalogVersionId: "catalog-alpha-1", amountMinor: -1 }],
      [{ catalogVersionId: "catalog-alpha-1", amountMinor: 1.25 }],
      [prices[0]!, prices[0]!],
    ]) {
      expect(() => addCommercialVersion(state, { ...base, prices: invalid })).toThrow();
    }
  });
  it("rejects two different revisions of the same item in one commercial table", () => {
    const fixture = createCatalogFixture();
    const state = addCatalogVersion(fixture, { ...fixture.catalogVersions[0]!, id: "alpha-new" });
    expect(() =>
      addCommercialVersion(state, {
        ...state.commercialVersions[0]!,
        id: "new",
        prices: [
          { catalogVersionId: "catalog-alpha-1", amountMinor: 10 },
          { catalogVersionId: "alpha-new", amountMinor: 20 },
        ],
      }),
    ).toThrow(/uma vez/);
  });
  it("rejects reversed or impossible dates", () => {
    const state = createCatalogFixture();
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("2028-02-29")).toBe(true);
    expect(currentCommercialVersion(state, "invalid")).toBeNull();
    expect(() =>
      addCommercialVersion(state, {
        ...state.commercialVersions[0]!,
        id: "new",
        validUntil: "2025-01-01",
      }),
    ).toThrow(/período/);
  });
  it("uses exact minor units without silently rounding currency input", () => {
    expect(parseAmount("149,90")).toBe(14990);
    expect(parseAmount("1.1")).toBe(110);
    for (const invalid of ["0", "-1", "1.234", "1e3", "NaN", "1.000,00", "99999999"])
      expect(() => parseAmount(invalid)).toThrow();
  });
  it("campaign identity and UTM must be unique synthetic metadata", () => {
    const state = createCatalogFixture();
    const base = { ...state.campaigns[0]!, id: "new", code: "demo-novo", utmCampaign: "demo-novo" };
    const next = addCampaign(state, base);
    expect(next.campaigns.at(-1)?.code).toBe("DEMO-NOVO");
    expect(() => addCampaign(next, { ...base, id: "other" })).toThrow(/utilizado/);
    expect(() => addCampaign(state, { ...base, code: "REAL" })).toThrow(/DEMO-/);
    expect(() => addCampaign(state, { ...base, endsOn: base.startsOn })).toThrow(/período/);
  });
  it("pins campaign references and denies duplicate or unrelated price versions", () => {
    let state = createCatalogFixture();
    const historic = state.references[0]!;
    expect(() => linkCampaign(state, historic)).toThrow(/vinculada/);
    expect(() => linkCampaign(state, { ...historic, commercialVersionId: "missing" })).toThrow(
      /pertence/,
    );
    state = linkCampaign(state, { ...historic, commercialVersionId: "commercial-2" });
    state = selectCommercialVersion(state, select("s", "commercial-2"));
    expect(state.references[0]).toEqual(historic);
    expect(state.commercialVersions[0]?.prices[0]?.amountMinor).toBe(12900);
  });
});
