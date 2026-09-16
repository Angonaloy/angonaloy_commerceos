import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Angonaloy order-number rebrand migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260916160209_angonaloy_order_numbering.sql"),
    "utf8",
  );

  it("retires the ML allocator and creates the AG allocator restarted at 1001", () => {
    expect(sql).toMatch(/drop function if exists public\.next_ml_order_number\(\)/i);
    expect(sql).toMatch(/alter sequence public\.orders_order_number_seq restart with 1001/i);
    expect(sql).toMatch(/create function public\.next_order_number\(\)/i);
    expect(sql).toContain("'AG-' || nextval('public.orders_order_number_seq')::text");
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(/revoke all on function public\.next_order_number/i);
    expect(sql).toMatch(/grant execute on function public\.next_order_number.*service_role/i);
  });
});
