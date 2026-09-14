### Task 3: Add The Order Detail Page

**Files:**
- Create: `src/pages/OrderDetail.tsx`
- Modify: `src/App.tsx`
- Test: `src/test/order-detail.test.ts`

**Interfaces:**
- Route: `/orders/:id`.
- Page consumes `GET /api/orders/:id` and mutates through `PATCH /api/orders/:id/items` using `apiFetch()`.

- [ ] **Step 1: Write failing page tests.**
  - Assert loading, not-found, customer/order summary, line-item rendering, add-product control, remove control, quantity editing, save state, server error display, and locked dispatched state.

- [ ] **Step 2: Run the page tests and confirm they fail because the route/page does not exist.**

- [ ] **Step 3: Implement the route and page using `ProductEdit` patterns.**
  - Use the existing dashboard layout, page header, `BuiInput`, `RichButton`, and navigation conventions.
  - Keep a local draft of line items and derive subtotal/quantity from the draft for display only.
  - Use the existing product catalog query for product selection and variant selection.
  - Preserve customer, delivery, payment, courier, fraud, timestamps, and status as read-only summary fields.
  - Disable all item controls and save when `canEditItems` is false.

- [ ] **Step 4: Implement save/cancel behavior.**
  - Save sends only item identity and quantities.
  - On success, replace the query cache with the server response.
  - On failure, preserve the draft and show the API error.
  - Cancel navigates back to `/` or the existing orders dashboard route without saving.

- [ ] **Step 5: Run page tests and verify all states.**

- [ ] **Step 6: Commit the page unit.**
  - `git add src/pages/OrderDetail.tsx src/App.tsx src/test/order-detail.test.ts`
  - `git commit -m "feat: add order detail editing page"`

