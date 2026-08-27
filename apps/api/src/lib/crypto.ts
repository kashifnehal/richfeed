import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM encryption for stored OAuth tokens (access_token,
 * refresh_token) in social_accounts.
 *
 * The key is read from TOKEN_ENCRYPTION_KEY lazily, at call time — not at
 * import time — so this module can be imported freely without requiring the
 * env var to be set (mirrors the lazy-client pattern from db/supabase.ts and
 * queue/connection.ts).
 *
 * Never log plaintext tokens or the key anywhere in this module.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit IV is the recommended size for GCM.

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;

  if (!hex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32",
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32",
    );
  }

  const key = Buffer.from(hex, "hex");

  if (key.length !== KEY_BYTES) {
    // Unreachable given the regex above, but guards against surprises.
    throw new Error(
      `TOKEN_ENCRYPTION_KEY decoded to ${key.length} bytes, expected ${KEY_BYTES}.`,
    );
  }

  return key;
}

/**
 * Encrypt a plaintext string. Output format is a single string:
 *   base64(iv):base64(authTag):base64(ciphertext)
 * Self-contained — decrypt() fully reverses it.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Reverse encrypt(). Throws if the ciphertext is malformed or has been
 * tampered with (GCM auth tag verification failure).
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext: expected 3 ':'-separated parts.");
  }

  const [ivB64, authTagB64, encryptedB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  if (iv.length !== IV_BYTES) {
    throw new Error("Malformed ciphertext: invalid IV length.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
