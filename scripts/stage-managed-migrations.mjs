// Stage canonical SQL under its actual managed ledger versions. No db repair.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const manifest = JSON.parse(fs.readFileSync("supabase/deployment-manifest.json", "utf8"));
const output = process.argv[2];
if (!output || !path.isAbsolute(output) || fs.existsSync(output)) {
  throw new Error("Pass a new absolute staging directory outside this repository");
}
const repo = fs.realpathSync(".");
if (output.startsWith(repo + path.sep)) throw new Error("Stage outside repository");
const dir = path.join(output, "supabase", "migrations");
fs.mkdirSync(dir, { recursive: true });
for (const migration of manifest.migrations) {
  const content = fs.readFileSync(path.join("supabase/migrations", migration.source));
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  if (digest !== migration.sha256)
    throw new Error("Canonical SQL hash mismatch: " + migration.source);
  const name = migration.remoteVersion + "_" + migration.source.replace(/\.sql$/, "") + ".sql";
  fs.writeFileSync(path.join(dir, name), content);
}
console.log(
  "Staged " + manifest.migrations.length + " immutable SQL files at actual ledger versions",
);
