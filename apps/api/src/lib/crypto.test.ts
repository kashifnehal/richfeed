import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

// A fixed, valid 32-byte hex key for deterministic, offline tests.
// Not a real credential — used only in this test process. Set at module
// load (rather than beforeAll) so it's in place before any test body runs,
// regardless of test/file execution order.
process.env.TOKEN_ENCRYPTION_KEY =
  "136b8d7312e9d096dc2a9827dcad847dba5353f8e85b99f5aed60f96c84e3f59";

describe("crypto round-trip", () => {
  const samples = [
    "simple-plaintext-token",
    "",
    "a very long access token ".repeat(50),
    "unicode: 日本語 emoji: 🔐🚀 mixed: café naïve",
    JSON.stringify({ access_token: "abc123", refresh_token: "xyz789" }),
  ];

  it.each(samples)("decrypt(encrypt(x)) === x for %j", (plaintext) => {
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });
});

describe("crypto IV uniqueness", () => {
  it("produces different ciphertext for the same plaintext on repeated calls", () => {
    const plaintext = "same-input-every-time";
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);

    expect(first).not.toBe(second);

    // Both must still decrypt correctly.
    expect(decrypt(first)).toBe(plaintext);
    expect(decrypt(second)).toBe(plaintext);
  });
});

// Flip every bit of the first byte, guaranteeing the decoded buffer changes
// (unlike flipping a single base64 character, which can land on unused
// padding bits and leave the decoded bytes unchanged).
function flipFirstByte(base64: string): string {
  const buf = Buffer.from(base64, "base64");
  buf.writeUInt8(buf.readUInt8(0) ^ 0xff, 0);
  return buf.toString("base64");
}

describe("crypto tamper detection", () => {
  it("throws when the ciphertext payload is tampered with", () => {
    const ciphertext = encrypt("do-not-tamper");
    const [iv, authTag, encrypted] = ciphertext.split(":") as [
      string,
      string,
      string,
    ];

    const tampered = [iv, authTag, flipFirstByte(encrypted)].join(":");

    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when the auth tag is tampered with", () => {
    const ciphertext = encrypt("do-not-tamper-2");
    const [iv, authTag, encrypted] = ciphertext.split(":") as [
      string,
      string,
      string,
    ];

    const tampered = [iv, flipFirstByte(authTag), encrypted].join(":");

    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on a malformed ciphertext string", () => {
    expect(() => decrypt("not-a-valid-ciphertext")).toThrow();
  });
});

describe("crypto missing/invalid key", () => {
  it("throws a clear error when TOKEN_ENCRYPTION_KEY is missing", () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;

    try {
      expect(() => encrypt("x")).toThrow(/TOKEN_ENCRYPTION_KEY/);
    } finally {
      process.env.TOKEN_ENCRYPTION_KEY = original;
    }
  });

  it("throws a clear error when TOKEN_ENCRYPTION_KEY is not 64 hex chars", () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "too-short";

    try {
      expect(() => encrypt("x")).toThrow(/64 hex/);
    } finally {
      process.env.TOKEN_ENCRYPTION_KEY = original;
    }
  });
});
