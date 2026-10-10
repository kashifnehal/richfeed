import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Hit daily by the Vercel cron in vercel.json. Supabase's free tier pauses a
 * project after 7 days without database activity, and this route is the one
 * keep-alive that doesn't depend on Railway being up. A real PostgREST query
 * is required — an auth health check alone doesn't count as activity. The
 * anon key under RLS returns no rows, which is fine: the query still runs.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await supabase.from("workspaces").select("id").limit(1);
  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 503 });
  }

  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
