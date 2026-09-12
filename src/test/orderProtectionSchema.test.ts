import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("order protection migration", () => {
  test("keeps protected review and event data workspace-scoped and private", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260912000000_order_protection.sql"), "utf8");

    expect(migration).toContain("create table if not exists public.order_protection_events");
    expect(migration).toContain("create table if not exists public.order_protection_reviews");
    expect(migration).toContain("org_id uuid not null");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("expires_at");
    expect(migration).toContain("reason_codes");
    expect(migration).not.toMatch(/grant\s+.*\s+to\s+(anon|authenticated)/iu);
  });

  test("stores contact status for persistent review workflow state", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260913000000_order_protection_contact_status.sql"), "utf8");

    expect(migration).toContain("add column if not exists contact_status");
    expect(migration).toContain("default 'open'");
    expect(migration).toContain("contacted");
    expect(migration).toContain("where contact_status is null");
  });
});
