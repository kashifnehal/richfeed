"use client";

import { createClient } from "./supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch wrapper for apps/api: attaches the current Supabase session's
 * access token as a bearer token and throws ApiError on non-2xx so callers
 * can show inline errors/toasts instead of getting back malformed data.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  const isFormData = init.body instanceof FormData;
  if (!isFormData && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    let message = `Request failed with status ${res.status}`;
    if (body && typeof body === "object" && "error" in body) {
      message = String((body as { error: unknown }).error);
    }
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface UploadMediaResult {
  url: string;
  path: string;
  /** What Supabase Storage recorded as the object's content-type. */
  contentType: string;
}

export async function uploadMedia(file: File): Promise<UploadMediaResult> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<UploadMediaResult>("/api/media", {
    method: "POST",
    body: form,
  });
}
