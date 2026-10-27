import { describe, expect, it } from "vitest";
import { recoveryFromFragment, isRecoveryCredential } from "@/modules/identity/recovery";

describe("recovery callback", () => {
  it("accepts a standard recovery fragment without retaining refresh tokens", () => {
    expect(
      recoveryFromFragment("#type=recovery&access_token=aaa.bbb.ccc&refresh_token=private"),
    ).toEqual({ kind: "access", value: "aaa.bbb.ccc" });
  });
  it("preserves custom one-use hash links", () => {
    expect(recoveryFromFragment("#token_hash=" + "a".repeat(64))).toEqual({
      kind: "hash",
      value: "a".repeat(64),
    });
  });
  it("rejects ordinary login, errors, missing and malformed credentials", () => {
    for (const value of [
      "",
      "#type=signup&access_token=aaa.bbb.ccc",
      "#type=recovery",
      "#token_hash=wrong",
      "#type=recovery&access_token=aaa.bbb.ccc&error_code=otp_expired",
    ]) {
      expect(recoveryFromFragment(value)).toBeNull();
    }
    expect(isRecoveryCredential({ kind: "access", value: "x".repeat(9000) })).toBe(false);
  });
});
