/** Recovery credentials stay in memory; never persist or log the URL fragment. */
export type RecoveryCredential =
  { kind: "hash"; value: string } | { kind: "access"; value: string };

export function isRecoveryCredential(value: unknown): value is RecoveryCredential {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item["value"] !== "string") return false;
  if (item["kind"] === "hash") return /^[a-f0-9]{64}$/i.test(item["value"]);
  return (
    item["kind"] === "access" &&
    item["value"].length <= 8192 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(item["value"])
  );
}

export function recoveryFromFragment(fragment: string): RecoveryCredential | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  if (params.has("error") || params.has("error_code")) return null;
  const credential = params.has("token_hash")
    ? { kind: "hash", value: params.get("token_hash") }
    : params.get("type") === "recovery"
      ? { kind: "access", value: params.get("access_token") }
      : null;
  return isRecoveryCredential(credential) ? credential : null;
}
