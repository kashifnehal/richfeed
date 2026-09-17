/**
 * Log a full platform API error body without leaking secrets if the
 * response echoes request headers or tokens. Used by Meta/YouTube adapters
 * so we can diagnose live 400/401s from the real payload, not just the
 * short `error.message`.
 */

const SECRET_KEY = /token|secret|authorization|password|api[_-]?key|access_token|refresh_token|client_secret/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(nested);
    }
    return out;
  }
  if (typeof value === "string" && /^(Bearer\s+|ya29[.\-])/i.test(value)) {
    return "[redacted]";
  }
  return value;
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_KEY.test(key)) parsed.searchParams.set(key, "[redacted]");
    }
    return parsed.toString();
  } catch {
    return "[unparseable-url]";
  }
}

export function logPlatformApiError(
  platform: string,
  status: number,
  url: string | undefined,
  body: unknown,
): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(redact(body));
  } catch {
    serialized = "[unserializable-body]";
  }
  // Cap so a huge HTML error page can't flood Railway logs.
  if (serialized.length > 8000) serialized = `${serialized.slice(0, 8000)}…[truncated]`;
  console.error(
    `[${platform}] API error status=${status} url=${url ? redactUrl(url) : "unknown"} body=${serialized}`,
  );
}

/** Read the body once as text, JSON-parse if possible. Safe after this: the Response body is consumed. */
export async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
