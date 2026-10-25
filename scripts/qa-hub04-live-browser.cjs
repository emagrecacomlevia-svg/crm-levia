// Opt-in real Auth integration: use only disposable @example.invalid QA identities.
const fs = require("fs"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.QA_PLAYWRIGHT);
const s = JSON.parse(fs.readFileSync(process.env.LEVIA_QA_FIXTURE));
assert.ok(s.users.every((x) => x.email.endsWith("@example.invalid")));
const report = {
  environment: "Local TanStack SSR with REAL Supabase Auth and synthetic QA manager",
  checks: [],
  errors: [],
  completed: false,
};
function pass(label) {
  report.checks.push(label);
  console.log("PASS " + label);
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
      page = await ctx.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto((process.env.QA_BASE_URL || "http://127.0.0.1:4173") + "/login", {
      waitUntil: "networkidle",
    });
    await page
      .getByLabel("E-mail", { exact: true })
      .fill(s.users.find((x) => x.label === "manager").email);
    await page.getByLabel("Senha", { exact: true }).fill(s.qaPassword);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await Promise.race([
      page.waitForURL("**/app", { timeout: 120000 }),
      page
        .getByRole("alert")
        .waitFor({ timeout: 120000 })
        .then(async () => {
          throw new Error("Login failed: " + (await page.getByRole("alert").innerText()));
        }),
    ]);
    await page.getByRole("navigation", { name: "Navegação administrativa" }).waitFor();
    pass("Real password login reaches protected SSR dashboard");
    const cookies = await ctx.cookies();
    const session = cookies.find((x) => x.name === "levia-dev-session");
    assert.ok(session);
    assert.ok(session.httpOnly);
    assert.equal(session.sameSite, "Lax");
    assert.ok(!session.value.includes(s.qaPassword));
    pass("Opaque HttpOnly SameSite=Lax development session cookie");
    await page.goto((process.env.QA_BASE_URL || "http://127.0.0.1:4173") + "/app/crm", {
      timeout: 120000,
      waitUntil: "networkidle",
    });
    assert.equal(new URL(page.url()).pathname, "/app/crm");
    pass("Delegated CRM scope allows protected route");
    await page.goto((process.env.QA_BASE_URL || "http://127.0.0.1:4173") + "/app/social-studio", {
      timeout: 120000,
      waitUntil: "networkidle",
    });
    await page.waitForURL("**/access-denied");
    pass("Missing Social capability denies route despite valid login");
    await page.goto((process.env.QA_BASE_URL || "http://127.0.0.1:4173") + "/app/core", {
      timeout: 120000,
      waitUntil: "networkidle",
    });
    assert.equal(new URL(page.url()).pathname, "/app/core");
    pass("Core capability allows protected route");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Abrir menu", exact: true }).waitFor();
    pass("Authenticated mobile navigation and Escape");
    const replay = cookies;
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.waitForURL("**/login", { timeout: 120000 });
    pass("Logout clears SSR session");
    await ctx.addCookies(replay);
    await page.goto((process.env.QA_BASE_URL || "http://127.0.0.1:4173") + "/app", {
      timeout: 120000,
      waitUntil: "networkidle",
    });
    await page.waitForURL(/\/(login|access-denied)$/);
    pass("Replayed cookie denied after remote logout");
    assert.deepEqual(report.errors, []);
    report.completed = true;
  } finally {
    await browser.close();
  }
})()
  .catch((e) => {
    report.errors.push(e.message);
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(
    () => (
      fs.mkdirSync("artifacts/hub04-live", { recursive: true }),
      fs.writeFileSync(
        "artifacts/hub04-live/browser-qa.json",
        JSON.stringify(report, null, 2) + "\n",
      )
    ),
  );
