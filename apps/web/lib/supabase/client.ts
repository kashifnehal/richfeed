import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for use in Client Components (auth forms,
 * the account/session menu, etc.). Uses the NEXT_PUBLIC_-prefixed anon key
 * — safe to ship to the browser, RLS is the real enforcement boundary.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
