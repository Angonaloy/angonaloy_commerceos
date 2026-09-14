### Task 1: Schema migration

The repo has exactly one migration, `20260828000000_canonical_greenfield_baseline.sql`, and
`scripts/verify-supabase-baseline.mjs` hardcodes that path. We add a **second** migration rather
than editing the baseline, because the baseline may already have been applied to the live
project, and we make the verifier apply every migration in order so it stays meaningful.

**Files:**
- Create: `supabase/migrations/20260829000000_warehouses.sql`
- Create: `src/test/warehouseSchema.test.ts`
- Modify: `scripts/verify-supabase-baseline.mjs:12-16`

**Interfaces:**
- Consumes: nothing.
- Produces: table `public.warehouses (id, org_id, name, address, contact_person, phone, is_default, deleted_at, created_at, updated_at)`; columns `products.warehouse_id`, `products.weight_kg`, `product_variants.weight_kg`, `orders.warehouse_id`, `orders.warehouse_auto`, `orders.weight_kg`, `social_inbox_orders.warehouse_id`, `social_inbox_orders.warehouse_auto`, `social_inbox_orders.weight_kg`.

- [ ] **Step 1: Write the failing test**

Create `src/test/warehouseSchema.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260829000000_warehouses.sql",
);

describe("warehouse migration", () => {
  it("creates the warehouses table with RLS enabled", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create table public\.warehouses\b/i);
    expect(sql).toMatch(/alter table public\.warehouses enable row level security/i);
  });

  it("enforces a single default warehouse per org", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/unique index warehouses_org_default_idx/i);
    expect(sql).toMatch(/where is_default and deleted_at is null/i);
  });

  it("adds warehouse and weight columns to commerce tables", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const column of [
      "alter table public.products add column warehouse_id",
      "alter table public.products add column weight_kg",
      "alter table public.product_variants add column weight_kg",
      "alter table public.orders add column warehouse_id",
      "alter table public.orders add column warehouse_auto",
      "alter table public.orders add column weight_kg",
      "alter table public.social_inbox_orders add column warehouse_id",
      "alter table public.social_inbox_orders add column warehouse_auto",
      "alter table public.social_inbox_orders add column weight_kg",
    ]) {
      expect(sql.toLowerCase()).toContain(column);
    }
  });

  it("seeds the Mango Lover default warehouse", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("Mango Lover");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/warehouseSchema.test.ts`
Expected: FAIL — `ENOENT: no such file or directory ... 20260829000000_warehouses.sql`

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260829000000_warehouses.sql`:

```sql
-- Warehouses are routing labels, not inventory locations. Stock remains one
-- number per product/variant; see the 2026-08-28 design spec.

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  address text,
  contact_person text,
  phone text,
  is_default boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index warehouses_org_name_idx
on public.warehouses (org_id, name)
where deleted_at is null;

create unique index warehouses_org_default_idx
on public.warehouses (org_id)
where is_default and deleted_at is null;

create index warehouses_org_listing_idx
on public.warehouses (org_id, deleted_at, created_at desc);

create trigger update_warehouses_updated_at
before update on public.warehouses
for each row execute function public.update_updated_at_column();

alter table public.warehouses enable row level security;

alter table public.products add column warehouse_id uuid references public.warehouses(id);
alter table public.products add column weight_kg numeric(10, 3) check (weight_kg is null or weight_kg >= 0);
alter table public.product_variants add column weight_kg numeric(10, 3) check (weight_kg is null or weight_kg >= 0);

alter table public.orders add column warehouse_id uuid references public.warehouses(id);
alter table public.orders add column warehouse_auto boolean not null default true;
alter table public.orders add column weight_kg numeric(10, 3) check (weight_kg is null or weight_kg >= 0);

alter table public.social_inbox_orders add column warehouse_id uuid references public.warehouses(id);
alter table public.social_inbox_orders add column warehouse_auto boolean not null default true;
alter table public.social_inbox_orders add column weight_kg numeric(10, 3) check (weight_kg is null or weight_kg >= 0);

create index products_org_warehouse_idx on public.products (org_id, warehouse_id);
create index orders_org_warehouse_created_idx on public.orders (org_id, warehouse_id, created_at desc);
create index social_inbox_orders_org_warehouse_idx on public.social_inbox_orders (org_id, warehouse_id, created_at desc);

-- Seed the single default warehouse for the existing workspace.
insert into public.warehouses (org_id, name, is_default)
select distinct org_id, 'Mango Lover', true
from public.user_roles
where org_id is not null
on conflict do nothing;

revoke all on public.warehouses from anon, authenticated;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/warehouseSchema.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Make the baseline verifier apply every migration**

In `scripts/verify-supabase-baseline.mjs`, replace the hardcoded single-file constant (lines
12–16) so the script applies all migrations in filename order. Add `readdirSync` to the existing
`node:fs` import, then:

```js
const migrationsDir = join(root, "supabase/migrations");
const migrationPaths = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => join(migrationsDir, name));
```

Then update every later use of `migrationPath` to loop over `migrationPaths` in order, applying
each with the same `psql` invocation the script already uses.

- [ ] **Step 6: Verify the migration actually applies**

Run: `npm run verify:supabase-baseline`
Expected: PASS. If PostgreSQL binaries are missing locally the script exits with a clear
"Install PostgreSQL or set PG_BINDIR" message — in that case set `PG_BINDIR` and re-run rather
than skipping this step, because a syntax error here is invisible to the Vitest test.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260829000000_warehouses.sql src/test/warehouseSchema.test.ts scripts/verify-supabase-baseline.mjs
git commit -m "feat: add warehouses table and warehouse/weight columns"
```

---

