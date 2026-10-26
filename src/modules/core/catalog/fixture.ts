import type { CatalogState } from "./model";

// DEMO only: invented references and prices, unrelated to LEVIA's actual catalog.
export function createCatalogFixture(): CatalogState {
  return {
    items: [
      { id: "item-alpha", sku: "DEMO-ALFA" },
      { id: "item-beta", sku: "DEMO-BETA" },
    ],
    catalogVersions: [
      {
        id: "catalog-alpha-1",
        itemId: "item-alpha",
        revision: 1,
        name: "Referência Alfa — fictícia",
        presentation: "Embalagem demonstrativa A",
        segment: "Exemplo de catálogo",
        documentRef: "DEMO-DOC-001",
      },
      {
        id: "catalog-beta-1",
        itemId: "item-beta",
        revision: 1,
        name: "Referência Beta — fictícia",
        presentation: "Embalagem demonstrativa B",
        segment: "Exemplo de catálogo",
        documentRef: "DEMO-DOC-002",
      },
    ],
    commercialVersions: [
      {
        id: "commercial-1",
        revision: 1,
        audience: "Público fictício",
        currency: "BRL",
        validFrom: "2026-01-01",
        validUntil: "2027-01-01",
        terms: "Valores de teste. Sem validade comercial.",
        prices: [
          { catalogVersionId: "catalog-alpha-1", amountMinor: 12900 },
          { catalogVersionId: "catalog-beta-1", amountMinor: 18900 },
        ],
      },
      {
        id: "commercial-2",
        revision: 2,
        audience: "Público fictício",
        currency: "BRL",
        validFrom: "2026-10-01",
        validUntil: "2026-11-01",
        terms: "Segunda versão de teste. Sem validade comercial.",
        prices: [
          { catalogVersionId: "catalog-alpha-1", amountMinor: 13900 },
          { catalogVersionId: "catalog-beta-1", amountMinor: 19900 },
        ],
      },
    ],
    // Neither the largest revision nor a matching date automatically selects a table.
    selections: [],
    campaigns: [
      {
        id: "campaign-1",
        code: "DEMO-OUTUBRO",
        name: "Campanha de demonstração",
        purpose: "Validar referências fixas com dados inventados.",
        channel: "interno",
        startsOn: "2026-10-01",
        endsOn: "2026-11-01",
        utmCampaign: "demo-outubro",
      },
    ],
    references: [
      {
        campaignId: "campaign-1",
        commercialVersionId: "commercial-1",
        catalogVersionId: "catalog-alpha-1",
      },
    ],
  };
}
