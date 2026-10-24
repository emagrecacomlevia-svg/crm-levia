// Browser QA for the public, data-free LEVIA HUB demonstration.
// Runs only against a loopback server; never creates a deployment.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require(process.env.QA_PLAYWRIGHT);
const base = process.env.QA_BASE_URL || "http://127.0.0.1:4173";
const out = path.resolve("artifacts/browser-qa");
const routes = [
  ["/", "LEVIA HUB"],
  ["/app", "LEVIA HUB — Visão Geral"],
  ["/app/social-studio", "Social Studio"],
  ["/app/crm", "CRM de Vendas"],
  ["/app/core", "Núcleo Administrativo"],
];
const widths = [320, 390, 768, 1280, 1440];
const result = { base, checks: [], errors: [], screenshots: [], completed: false };

function record(name) {
  result.checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
}

async function screenshot(page, name) {
  const destination = path.join(out, name);
  await page.screenshot({ path: destination, fullPage: true });
  result.screenshots.push(name);
  record(`captura ${name}`);
}

async function noOverflow(page, route, width) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.page <= dimensions.viewport + 1,
    `Overflow horizontal em ${route} a ${width}px: ${JSON.stringify(dimensions)}`,
  );
}

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => result.errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        result.errors.push(`console: ${message.text()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 500) {
        result.errors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, heading] of routes) {
        const response = await page.goto(`${base}${route}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        assert.equal(response.status(), 200, `HTTP direto em ${route} (${width}px)`);
        await page.getByRole("heading", { level: 1, name: heading }).waitFor();
        await noOverflow(page, route, width);
        if (route.startsWith("/app")) {
          const active = page
            .getByRole("navigation", { name: "Navegação administrativa" })
            .getByRole("link", { name: /ATUAL/ });
          const current = await active.first().getAttribute("aria-current");
          assert.equal(current, "page", `Estado ativo de ${route}`);
          assert.equal(await page.getByText("Ambiente demonstrativo").count(), 1);
        }
        record(`acesso direto ${route}, largura ${width}px e sem overflow`);
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/app`, { waitUntil: "networkidle" });
    assert.equal(
      await page.getByRole("navigation", { name: "Navegação administrativa" }).isVisible(),
      true,
    );
    await screenshot(page, "dashboard-desktop-1440.png");

    await page
      .getByRole("navigation", { name: "Navegação administrativa" })
      .getByRole("link", { name: /Social Studio/ })
      .click();
    await page.waitForURL("**/app/social-studio");
    await page.getByRole("heading", { level: 1, name: "Social Studio" }).waitFor();
    await screenshot(page, "social-studio-desktop-1440.png");
    record("navegação TanStack desktop para módulo");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Abrir demonstração do HUB/ }).click();
    await page.waitForURL("**/app");
    await page.getByRole("heading", { level: 1, name: "LEVIA HUB — Visão Geral" }).waitFor();
    record("entrada SPA institucional para /app");

    await screenshot(page, "dashboard-mobile-390.png");
    const trigger = page.getByRole("button", { name: "Abrir menu" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Navegação do LEVIA HUB" });
    await dialog.waitFor();
    assert.equal(
      await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
      true,
      "Foco deve permanecer no diálogo aberto",
    );
    await screenshot(page, "menu-mobile-aberto-390.png");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await trigger.focus();
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
    record("menu: abre, captura, Escape fecha e foco retorna");

    await trigger.click();
    await dialog.getByRole("link", { name: /Núcleo Administrativo/ }).click();
    await page.waitForURL("**/app/core");
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("heading", { level: 1, name: "Núcleo Administrativo" }).waitFor();
    record("menu: seleção troca seção e fecha o diálogo");

    await page.goto(`${base}/app/crm`, { waitUntil: "networkidle" });
    assert.equal(await page.getByRole("textbox").count(), 0);
    assert.equal(await page.getByRole("button", { name: /salvar|publicar|aprovar/i }).count(), 0);
    record("CRM demonstrativo sem formulários ou comandos operacionais");
    assert.deepEqual(result.errors, [], `Erros em navegador: ${JSON.stringify(result.errors)}`);
    result.completed = true;
  } finally {
    await browser.close();
  }
}

run()
  .catch((error) => {
    result.errors.push(error.stack || String(error));
    process.exitCode = 1;
    process.stderr.write(`${error.stack || error}\n`);
  })
  .finally(() => {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "qa-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  });
