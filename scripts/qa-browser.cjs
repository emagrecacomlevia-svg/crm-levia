// HUB-04 browser QA: public presentation and default-denied administrative paths.
// All checks use loopback and synthetic inputs; invalid synthetic login cannot create identities or grants.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require(process.env.QA_PLAYWRIGHT);
const base = process.env.QA_BASE_URL || "http://127.0.0.1:4173";
const out = path.resolve("artifacts/browser-qa");
const restricted = ["/app", "/app/core", "/app/crm", "/app/social-studio"];
const widths = [320, 390, 768, 1280, 1440];
const result = { base, checks: [], errors: [], screenshots: [], completed: false };

function record(name) {
  result.checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, name), fullPage: true });
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

async function expectDenied(page, from, width) {
  await page.waitForURL(/\/(login|access-denied)(?:\?.*)?$/, { timeout: 15000 });
  const url = new URL(page.url());
  assert.ok(["/login", "/access-denied"].includes(url.pathname));
  assert.equal(
    await page.getByRole("navigation", { name: "Navegação administrativa" }).count(),
    0,
    `Navegação interna exposta em ${from}`,
  );
  await page
    .getByRole("heading", {
      level: 1,
      name: /Acesso ao LEVIA HUB|Acesso administrativo indisponível/,
    })
    .waitFor();
  await noOverflow(page, from, width);
  record(`acesso negado ${from}, largura ${width}px`);
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
      if (message.type() === "error") result.errors.push(`console: ${message.text()}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 500) {
        result.errors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, heading] of [
        ["/", "LEVIA HUB"],
        ["/login", "Acesso ao LEVIA HUB"],
        ["/demo", "Laboratório de acesso"],
        ["/access-denied", "Acesso administrativo indisponível"],
      ]) {
        const response = await page.goto(base + route, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        assert.equal(response.status(), 200, `HTTP ${route} a ${width}px`);
        await page.getByRole("heading", { level: 1, name: heading }).waitFor();
        await noOverflow(page, route, width);
        record(`página pública ${route}, largura ${width}px`);
      }
      for (const route of restricted) {
        await page.goto(base + route, { waitUntil: "networkidle", timeout: 30000 });
        await expectDenied(page, route, width);
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await screenshot(page, "home-desktop-1440.png");

    await page.goto(base + "/demo", { waitUntil: "networkidle" });
    await page.getByLabel("Selecionar cenário").selectOption("allowed");
    await page.getByTestId("demo-result").getByText("Permitido no cenário fictício").waitFor();
    await page.getByLabel("Selecionar cenário").selectOption("revoked");
    await page.getByTestId("demo-result").getByText("Acesso negado").waitFor();
    record("simulador sintético permite apenas cenário válido e nega revogação");
    await screenshot(page, "demo-desktop-1440.png");

    await page.goto(base + "/login", { waitUntil: "networkidle" });
    await screenshot(page, "login-desktop-1440.png");

    await page.getByRole("textbox", { name: "E-mail" }).fill("synthetic@example.invalid");
    await page.getByLabel("Senha").fill("not-a-real-password");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(
      await page.getByRole("navigation", { name: "Navegação administrativa" }).count(),
      0,
    );
    record("login sintético inválido retorna erro e não libera acesso");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/app", { waitUntil: "networkidle" });
    await expectDenied(page, "/app/mobile", 390);
    await screenshot(page, "access-denied-mobile-390.png");

    const noScript = await browser.newContext({ javaScriptEnabled: false });
    const noScriptPage = await noScript.newPage();
    await noScriptPage.goto(base + "/login");
    assert.equal(await noScriptPage.locator("form").getAttribute("method"), "post");
    assert.equal(
      await noScriptPage.getByRole("button", { name: "Entrar", exact: true }).isDisabled(),
      true,
    );
    record(
      "sem JavaScript, login permanece bloqueado e formulário usa POST, sem credenciais na URL",
    );
    await noScript.close();

    assert.deepEqual(result.errors, [], `Erros no navegador: ${JSON.stringify(result.errors)}`);
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
