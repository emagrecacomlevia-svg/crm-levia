// Loopback-only browser QA. Synthetic fixtures; no Supabase/API/account dependency.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.QA_PLAYWRIGHT);
const base = process.env.QA_BASE_URL || "http://127.0.0.1:4173";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Only loopback QA is allowed",
);
const out = path.resolve("artifacts/hub05-browser");
const result = { checks: [], errors: [], supabaseRequests: [], screenshots: [], completed: false };
const record = (name) => {
  result.checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
};

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", (error) => result.errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).hostname.endsWith(".supabase.co"))
        result.supabaseRequests.push(request.url());
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Catálogo e campanhas · laboratório" }).click();
    await page.getByRole("heading", { level: 1, name: "Catálogo e campanhas" }).waitFor();
    assert.match(await page.getByTestId("current-table").textContent(), /Sem tabela vigente/);
    record("home navigation; initial versions are not automatically selected");
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(
        dimensions.scroll <= dimensions.width + 1,
        `Overflow at ${width}: ${JSON.stringify(dimensions)}`,
      );
      record(`no horizontal overflow at ${width}px`);
    }
    await page
      .getByLabel("Motivo da seleção")
      .fill("Seleção explícita para ensaio fictício do histórico.");
    await page.getByLabel("Tabela a selecionar").selectOption("commercial-1");
    await page.getByRole("button", { name: "Registrar seleção fictícia" }).click();
    await page.getByTestId("current-table").getByText("Tabela v1 selecionada").waitFor();
    await page.getByLabel("Tabela a selecionar").selectOption("commercial-2");
    await page.getByRole("button", { name: "Registrar seleção fictícia" }).click();
    await page.getByTestId("current-table").getByText("Tabela v2 selecionada").waitFor();
    await page.getByLabel("Data de consulta").fill("2026-11-01");
    await page.getByTestId("current-table").getByText("Sem tabela vigente nesta data").waitFor();
    await page.getByText(/Tabela v1 · R\$.*129,00 fictícios/).waitFor();
    record("expiry does not revive older table; campaign keeps original price");

    await page.getByText("Criar versão de catálogo", { exact: true }).click();
    await page.getByLabel("Nome fictício", { exact: true }).fill("Referência Alfa revisão QA");
    await page.getByLabel("Apresentação", { exact: true }).fill("Embalagem QA fictícia");
    await page.getByLabel("Segmento", { exact: true }).fill("Ensaio");
    await page.getByLabel("Referência documental fictícia").fill("DEMO-DOC-QA");
    await page.getByRole("button", { name: "Criar versão", exact: true }).click();
    await page.getByRole("heading", { name: "Referência Alfa revisão QA" }).waitFor();
    await page.getByText(/Tabela v1 · R\$.*129,00 fictícios/).waitFor();
    record("new catalog revision preserves original campaign reference");

    await page.getByText("Criar tabela demonstrativa", { exact: true }).click();
    await page
      .getByLabel("Versão do item")
      .selectOption({ label: "Referência Alfa revisão QA · catálogo v2" });
    await page.getByLabel("Preço fictício (R$)").fill("149,90");
    await page.getByRole("button", { name: "Criar tabela", exact: true }).click();
    await page.getByRole("heading", { name: "Tabela v3", exact: true }).waitFor();
    assert.match(await page.getByTestId("current-table").textContent(), /Sem tabela vigente/);
    record("new commercial table retains exact cents and requires separate selection");

    await page.getByText("Criar campanha fictícia", { exact: true }).click();
    await page.getByLabel("Código da campanha").fill("DEMO-QA");
    await page.getByLabel("Nome da campanha").fill("Campanha QA fictícia");
    await page
      .getByLabel("Finalidade", { exact: true })
      .fill("Teste da referência fixa da campanha");
    await page.getByLabel("Identificador UTM").fill("demo-qa");
    await page.getByRole("button", { name: "Criar campanha", exact: true }).click();
    await page.getByRole("heading", { name: "Campanha QA fictícia" }).waitFor();
    await page.getByText("Vincular referência a campanha", { exact: true }).click();
    await page.getByLabel("Campanha", { exact: true }).selectOption({ label: "DEMO-QA" });
    await page.getByLabel("Tabela de referência").selectOption({ label: "Tabela v3" });
    await page.getByRole("button", { name: "Vincular referência", exact: true }).click();
    await page.getByText(/Tabela v3 · R\$.*149,90 fictícios/).waitFor();
    await page.getByRole("button", { name: "Vincular referência", exact: true }).click();
    await page.getByRole("alert").getByText("Referência já vinculada.").waitFor();
    record("campaign creation, exact version binding and duplicate rejection");

    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
      "Forms overflow on mobile",
    );
    record("expanded forms fit mobile viewport");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByRole("heading", { name: "Campanha QA fictícia" }).count(), 0);
    assert.match(await page.getByTestId("current-table").textContent(), /Sem tabela vigente/);
    record("reload discards simulation and restores synthetic fixture");
    for (const [width, file] of [
      [390, "catalog-mobile.png"],
      [1440, "catalog-desktop.png"],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      result.screenshots.push(file);
    }
    assert.deepEqual(result.supabaseRequests, [], "Synthetic workspace called Supabase");
    assert.deepEqual(result.errors, [], "Browser runtime errors");
    record("no Supabase requests or browser runtime errors");
    result.completed = true;
  } finally {
    await browser.close();
  }
}
run()
  .catch((error) => {
    result.errors.push(error.stack || String(error));
    process.exitCode = 1;
    process.stderr.write(String(error) + "\n");
  })
  .finally(() => {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "qa-result.json"), JSON.stringify(result, null, 2) + "\n");
  });
