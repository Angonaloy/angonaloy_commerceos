### Task 1: Add Order Item Schema And Backfill

**Files:**
- Create: `supabase/migrations/<generated>_add_order_items.sql`
- Modify: `src/integrations/supabase/types.ts`
- Test: `src/test/order-items.test.ts`

**Interfaces:**
- Produces `order_items(id, org_id, order_id, product_id, variant_id, product_name, variant_name, unit_price, quantity, created_at, updated_at)`.
- Produces a backfill that preserves every existing order even when `orders.product` cannot be parsed into a catalog product.

- [ ] **Step 1: Inspect the live baseline and create the migration through the project Supabase workflow.**
  - Run `npm run verify:supabase-project`.
  - Run `npm run verify:supabase-baseline`.
  - Use the Supabase migration command to create the next hand-authored migration name; do not invent a migration version.
  - Confirm `orders`, `products`, and any variant/inventory columns before finalizing foreign keys.

- [ ] **Step 2: Write failing tests for line-item invariants.**
  - Cover positive integer quantities, non-negative unit prices, order/org ownership, and preservation of a legacy product text value.
  - Assert that an order with no interpretable product still gets one legacy item rather than being dropped.

- [ ] **Step 3: Run the tests and confirm they fail for the missing schema/backfill behavior.**

- [ ] **Step 4: Add the table, indexes, constraints, and data-preserving backfill.**
  - Add indexes on `(org_id, order_id)` and optional product/variant references.
  - Enable RLS and add policies consistent with the existing private merchant access model, even though runtime access uses the authenticated service API.
  - Keep legacy product text in `product_name` when no product reference can be resolved.
  - Populate item aggregates without changing existing order totals.

- [ ] **Step 5: Regenerate TypeScript Supabase types and run the item tests.**
  - Expected: all line-item tests pass and generated types include `order_items`.

- [ ] **Step 6: Commit the schema unit.**
  - `git add supabase/migrations src/integrations/supabase/types.ts src/test/order-items.test.ts`
  - `git commit -m "feat: add order item records"`

