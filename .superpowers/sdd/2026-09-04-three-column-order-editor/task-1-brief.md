### Task 1: Persist Item Discounts Atomically

**Files:**
- Create: supabase/migrations/20260904000100_add_order_item_discounts.sql
- Modify: src/integrations/supabase/types.ts
- Modify: src/test/order-items.test.ts

**Interfaces:**
- Consumes: public.order_items, public.orders.discount, public.replace_order_items(uuid, uuid, jsonb).
- Produces: discount_type, discount_value, unit_discount fields and an RPC accepting discountType and discountValue per item.

- [ ] **Step 1: Write failing schema and type tests**

Add and apply discountMigrationPath in the PostgreSQL harness. Extend the typed row fixture with:

    discount_type: null,
    discount_value: 0,
    unit_discount: 0,

Add SQL assertions that reject negative values, unsupported types, percentages above 100, and unit_discount greater than unit_price.

- [ ] **Step 2: Write failing transaction tests**

Call replace_order_items with fixed and percentage JSON values. Assert authoritative unit_price, calculated unit_discount, aggregate orders.discount, and net orders.price. Add a legacy case proving that orders.discount minus existing item discounts survives replacement. Add rollback checks for invalid discounts and insufficient stock.

- [ ] **Step 3: Verify RED**

Run: npm test -- src/test/order-items.test.ts

Expected: failures for the absent migration, fields, and calculations.

- [ ] **Step 4: Add the data-preserving migration**

Add nullable discount_type constrained to fixed or percentage, non-negative discount_value numeric(12,2) default 0, and non-negative unit_discount numeric(12,2) default 0 constrained not to exceed unit_price.

Redefine replace_order_items. Resolve authoritative catalog price, then calculate:

    fixed: unit_discount = discount_value
    percentage: unit_discount = round(unit_price * discount_value / 100, 2)
    none: unit_discount = 0

Before deleting old rows, calculate legacy_discount as the non-negative difference between locked_order.discount and the sum of existing item unit_discount times quantity. Update orders.discount to legacy_discount plus new item discounts and orders.price to gross merchandise subtotal minus the aggregate discount. Retain all ownership checks, ordered locks, inventory deltas, grants, and security-invoker behavior.

- [ ] **Step 5: Update generated TypeScript shapes**

Add the three fields to Row, Insert, and Update, with optional defaults in Insert/Update.

- [ ] **Step 6: Verify GREEN**

Run: npm test -- src/test/order-items.test.ts

Expected: all schema and transaction tests pass.

