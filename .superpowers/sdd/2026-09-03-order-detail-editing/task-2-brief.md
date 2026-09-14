### Task 2: Add Order Detail And Item Mutation API

**Files:**
- Modify: `server/index.js`
- Test: `src/test/order-items.test.ts`

**Interfaces:**
- `GET /api/orders/:id` returns `{ order, items, canEditItems }`.
- `PATCH /api/orders/:id/items` accepts `{ items: [{ productId?, variantId?, quantity }] }` and returns the recalculated order plus items.

- [ ] **Step 1: Add failing API/service tests.**
  - Test authenticated org-scoped detail loading.
  - Test add, remove, increase, and decrease operations.
  - Test server-side total recalculation while ignoring a client total.
  - Test insufficient inventory rollback, wrong-org rejection, malformed item rejection, and courier-dispatched locking.

- [ ] **Step 2: Run the focused tests and verify expected failures.**

- [ ] **Step 3: Implement authenticated detail loading in the orders domain section.**
  - Resolve the current user and workspace using existing helpers.
  - Query the order and items with `.eq("org_id", orgId)` and `.eq("id", orderId)`.
  - Return a derived editability flag based on courier dispatch fields/status.

- [ ] **Step 4: Implement the item replacement mutation with server-owned calculations.**
  - Validate product and variant ownership under the same `org_id`.
  - Reject duplicate product/variant keys and quantities below 1.
  - Lock the order and affected inventory rows before calculating deltas.
  - Apply stock reservations/releases, replace item rows, recalculate aggregate quantity/price/product summary, and commit atomically.
  - Return a conflict-style error when a dispatched order is edited or stock is insufficient.

- [ ] **Step 5: Run focused API tests and verify rollback paths.**

- [ ] **Step 6: Commit the API unit.**
  - `git add server/index.js src/test/order-items.test.ts`
  - `git commit -m "feat: add order item editing API"`

