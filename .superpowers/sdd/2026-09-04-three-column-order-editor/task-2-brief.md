### Task 2: Validate Discount Intent and Enrich Detail Data

**Files:**
- Modify: server/index.js
- Modify: src/test/order-items.test.ts

**Interfaces:**
- Consumes: Task 1 RPC fields and org-scoped catalog tables.
- Produces: normalized item payload { productId, variantId, quantity, discountType, discountValue } and enriched display items.

- [ ] **Step 1: Write failing API contract tests**

Require discountType and discountValue validation, fixed/percentage allowlisting, the 100-percent ceiling, rejection of client price/unitDiscount, and org_id guards on catalog enrichment.

- [ ] **Step 2: Verify RED**

Run: npm test -- src/test/order-items.test.ts

Expected: contract failures.

- [ ] **Step 3: Normalize the request boundary**

For each item, accept null/fixed/percentage plus a finite non-negative numeric value. Reject percentage above 100. Pass only identity, quantity, discountType, and discountValue to the RPC. Never accept a calculated unit discount or total.

- [ ] **Step 4: Enrich GET and PATCH item responses**

Batch-load referenced org-scoped products, variants, and product images. Return product_slug, image_url, weight_kg, and available_stock as display-only metadata. Variant weight/stock wins over product weight/stock. Add the quantity already reserved by this order to editable availability.

- [ ] **Step 5: Handle detached legacy rows explicitly**

Keep customer-only saves possible. If the cart draft still contains an item without product_id/variant_id and the cart changes, return a clear UI validation message requiring the merchant to remove or replace that legacy item; never silently drop it.

- [ ] **Step 6: Verify GREEN**

Run: npm test -- src/test/order-items.test.ts

Expected: all API and transaction tests pass.

