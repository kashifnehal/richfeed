/**
 * Applies every SQL file in supabase/migrations/ (lexicographic order) against
 * the database at DATABASE_URL, tracking applied files in a `schema_migrations`
 * table so re-runs are a no-op. Admin/one-off use only — request-time code goes
 * through getSupabaseClient() (REST, respects RLS); this uses a direct `pg`
 * connection because DDL / trigger creation can't go through PostgREST.
 *
 *   pnpm --filter api migrate            # apply pending migrations
 *   pnpm --filter api migrate -- --status  # list applied vs pending, apply nothing
 *
 * DATABASE_URL must be the Supabase *session pooler* string (see CLAUDE.md) —
 * the direct db.<ref>.supabase.co host is IPv6-only and unreachable here.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../supabase/migrations",
);

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function main() {
  const statusOnly = process.argv.slice(2).includes("--status");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[migrate] DATABASE_URL is not set (needs the session-pooler string)");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    // Baseline: 0001 was applied by hand (via the Supabase SQL editor) before
    // this runner existed, and it has no `if not exists` guards. If the core
    // schema is already present but untracked, record 0001 as applied so we
    // don't try to re-run it.
    const { rows: baselineRows } = await client.query<{ filename: string }>(
      "select filename from schema_migrations",
    );
    if (baselineRows.length === 0) {
      const { rows: coreRows } = await client.query<{ exists: boolean }>(
        "select to_regclass('public.social_accounts') is not null as exists",
      );
      if (coreRows[0]?.exists) {
        await client.query(
          "insert into schema_migrations (filename) values ('0001_init_schema.sql') on conflict do nothing",
        );
        console.log("[migrate] baseline: recorded 0001_init_schema.sql as already-applied");
      }
    }

    const { rows } = await client.query<{ filename: string }>(
      "select filename from schema_migrations",
    );
    const applied = new Set(rows.map((r) => r.filename));
    const files = listMigrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    console.log(`[migrate] ${files.length} migration file(s), ${applied.size} applied, ${pending.length} pending`);
    for (const f of files) {
      console.log(`  ${applied.has(f) ? "✓" : "·"} ${f}`);
    }

    if (statusOnly || pending.length === 0) {
      console.log(statusOnly ? "[migrate] --status: nothing applied" : "[migrate] up to date");
      return;
    }

    for (const filename of pending) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      console.log(`[migrate] applying ${filename}...`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
        await client.query("commit");
        console.log(`[migrate] ✓ ${filename}`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    console.log("[migrate] done");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
