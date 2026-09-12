# Order Protection Abandoned-Style Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Order Protection review queue to use the Dashboard Abandoned queue's row UI, with contact actions, Dismiss-to-reject, protection details, and line-by-line product quantities.

**Architecture:** Keep the existing `OrderProtectionReviewQueue` as the owner of protection fetching and mutations. Add a small pure display-helper module for safely normalizing stored protection item payloads, computing totals, formatting source labels, and creating contact links. Reuse the abandoned queue's established classes and interaction patterns without changing the abandoned queue's public API.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Phosphor Icons, Radix dropdown/alert dialog, Vitest, Testing Library.

## Global Constraints

- All authenticated frontend API calls use `apiFetch()` from `src/lib/api.ts`.
- Accept and Reject continue using `updateProtectionReview(reviewId, action)`.
- Dismiss uses the existing protection Reject mutation and does not call abandoned-checkout routes.
- Contact status is local page-session state only because the protection API has no contact-status field.
- Product names, variants, prices, phone numbers, and addresses are rendered from server data without exposing hashes or internal network signals.
- All visible copy remains English.
- Use Phosphor Icons with `weight="light"` for new icons.
- Run Vitest, lint, build, and `git diff --check` before shipping.

---

### Task 1: Add pure protection queue display helpers

**Files:**
- Create: `src/lib/orderProtectionDisplay.ts`
- Create: `src/test/orderProtectionDisplay.test.ts`
- Modify: `src/lib/orderProtection.ts:1-25` only if the shared item type needs to be exported

**Interfaces:**
- Consumes: `ProtectionReview["items"]` records from `src/lib/orderProtection.ts`.
- Produces: `normalizeProtectionItem(item)`, `formatProtectionItem(item)`, `calculateProtectionTotal(items)`, `formatProtectionTotal(total)`, `protectionSourceLabel(sourceRoute)`, `protectionTelHref(phone)`, `protectionWhatsAppHref(phone)`, and `protectionCopySummary(review)` for the queue component.

- [ ] **Step 1: Write failing helper tests**

Add tests covering the exact supported payload variants:

```ts
import { describe, expect, it } from "vitest";
import {
  calculateProtectionTotal,
  formatProtectionTotal,
  formatProtectionItem,
  normalizeProtectionItem,
  protectionSourceLabel,
  protectionTelHref,
  protectionWhatsAppHref,
} from "@/lib/orderProtectionDisplay";

describe("order protection display helpers", () => {
  it("normalizes product, variant, quantity, and price fields", () => {
    expect(normalizeProtectionItem({
      productName: "Katimon Mango",
      variantName: "6KG",
      quantity: 2,
      unitPrice: 1180,
    })).toEqual({ productName: "Katimon Mango", variantName: "6KG", quantity: 2, unitPrice: 1180 });
  });

  it("formats one product line with the quantity first", () => {
    expect(formatProtectionItem({
      product_name: "Honey",
      variant_name: "1 kg",
      quantity: 3,
      unit_price: 800,
    })).toBe("3 × Honey — 1 kg · ৳800");
  });

  it("computes a total only from valid priced lines", () => {
    expect(calculateProtectionTotal([
      { productName: "Honey", quantity: 2, unitPrice: 800 },
      { productName: "Mango", quantity: 1, unitPrice: 1200 },
    ])).toBe(2800);
    expect(calculateProtectionTotal([{ productName: "Unknown", quantity: 1, unitPrice: null }])).toBeNull();
    expect(formatProtectionTotal(2800)).toBe("৳2,800");
    expect(formatProtectionTotal(null)).toBe("—");
  });

  it("uses English source labels and safe Bangladesh contact links", () => {
    expect(protectionSourceLabel("public_v1")).toBe("Storefront checkout");
    expect(protectionTelHref("01712345678")).toBe("tel:01712345678");
    expect(protectionWhatsAppHref("01712345678")).toBe("https://wa.me/8801712345678");
    expect(protectionTelHref("123")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --run src/test/orderProtectionDisplay.test.ts`

Expected: FAIL because `src/lib/orderProtectionDisplay.ts` does not exist yet.

- [ ] **Step 3: Implement the helper module**

Implement the helpers with immutable return values and safe fallbacks:

```ts
export type ProtectionLineItem = {
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number | null;
};

export function normalizeProtectionItem(item: Record<string, unknown>): ProtectionLineItem {
  const productName = String(item.productName ?? item.product_name ?? "Product").trim() || "Product";
  const variantValue = item.variantName ?? item.variant_name;
  const variantName = typeof variantValue === "string" && variantValue.trim() ? variantValue.trim() : null;
  const quantityValue = Number(item.quantity);
  const quantity = Number.isInteger(quantityValue) && quantityValue > 0 ? quantityValue : 1;
  const priceValue = Number(item.unitPrice ?? item.unit_price);
  const unitPrice = Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : null;
  return { productName, variantName, quantity, unitPrice };
}
```

Format prices with the existing `৳` convention and `en-BD` locale. Use `null` for an unavailable total rather than treating an unknown price as zero. Reuse the same 11-digit `01` phone validation used by the abandoned checkout helpers.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npm test -- --run src/test/orderProtectionDisplay.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the helper module**

```bash
git add src/lib/orderProtectionDisplay.ts src/test/orderProtectionDisplay.test.ts
git commit -m "feat: add order protection display helpers"
```

### Task 2: Replace the protection card with the abandoned-style row

**Files:**
- Modify: `src/components/OrderProtectionReviewQueue.tsx`
- Modify: `src/test/orderProtectionPage.test.tsx`

**Interfaces:**
- Consumes: `ProtectionReview`, the display helpers from Task 1, `updateProtectionReview`, existing `Chip`, `Spinner`, `DropdownMenu`, and `AlertDialog` components.
- Produces: The same responsive row structure as `AbandonedCheckoutQueue`, with protection-specific risk fields and actions.

- [ ] **Step 1: Extend the page test with the required row contract**

Update the fixture to include two priced items and assert the visible UI:

```ts
items: [
  { productName: "Katimon Mango", variantName: "6KG", quantity: 2, unitPrice: 1180 },
  { product_name: "Honey", quantity: 1, unit_price: 800 },
],
source_route: "public_v1",
```

Add assertions for `2 × Katimon Mango — 6KG · ৳1,180`, `1 × Honey · ৳800`, `Storefront checkout`, Call, WhatsApp, Copy, Awaiting contact, Dismiss, Accept, Reject, `Risk score`, and both reason codes. Also assert that the queue's select-all checkbox is present.

- [ ] **Step 2: Run the updated page test and verify it fails**

Run: `npm test -- --run src/test/orderProtectionPage.test.tsx`

Expected: FAIL because the current protection card does not render the abandoned-style actions, product lines, source label, or selection controls.

- [ ] **Step 3: Implement selection, copy, contact, and dismiss state**

In `OrderProtectionReviewQueue`:

```ts
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [contactStatus, setContactStatus] = useState<Record<string, "open" | "contacted">>({});
const [dismissTarget, setDismissTarget] = useState<ProtectionReview | null>(null);
```

Use immutable `Set` and record replacements. Add select-all and per-row checkbox controls with the same accessible roles and focus behavior as `AbandonedCheckoutQueue`. Contact status defaults to `open`, updates only local state, and never makes an API request. Copy the current protection summary through `navigator.clipboard.writeText`; expose success/failure through an `aria-live` region.

- [ ] **Step 4: Implement the abandoned-style row markup**

Use the abandoned queue's `grid-cols-[auto_minmax(0,1fr)]` mobile and `lg:grid-cols-[auto_minmax(0,1fr)_auto]` desktop layout. The customer block must contain:

```tsx
<p>{review.customer_name || "Customer name not provided"}</p>
<span>On hold</span>
<span>{protectionSourceLabel(review.source_route)}</span>
<span>{captureTime(review.created_at)}</span>
<Chip>{formatProtectionTotal(calculateProtectionTotal(review.items))}</Chip>
```

Render phone and address with copy controls. Render risk score beside the summary and risk reasons as rose chips. Render each normalized item as its own list item using `formatProtectionItem(item)`; never collapse the list into the literal `Cart Product × 1` format.

- [ ] **Step 5: Add all actions with the correct behavior**

Use Phosphor `Phone`, `WhatsappLogo`, `Copy`, `CaretDown`, `Trash`, `Check`, and `X` icons with `weight="light"`.

- Call and WhatsApp use the safe helpers and are omitted for invalid/missing phones.
- Copy copies the protection summary and shows `Copied` temporarily.
- Contact status uses `DropdownMenuRadioGroup` with `Awaiting contact` and `Contacted`, and updates only local state.
- Accept calls `handleAction(review.id, "approve")`.
- Reject calls `handleAction(review.id, "reject")`.
- Dismiss opens an `AlertDialog`; confirmation calls `handleAction(review.id, "reject")`, so it persists the existing rejected decision and removes the review after success.
- All action controls are disabled while the row mutation is in flight.

Keep the existing loading, error, empty, fetch, approve, and reject behavior intact.

- [ ] **Step 6: Run the page test and verify it passes**

Run: `npm test -- --run src/test/orderProtectionPage.test.tsx`

Expected: PASS, including the product, risk, contact, and mutation assertions.

- [ ] **Step 7: Commit the queue implementation**

```bash
git add src/components/OrderProtectionReviewQueue.tsx src/test/orderProtectionPage.test.tsx
git commit -m "feat: align order protection with abandoned queue"
```

### Task 3: Verify the complete change

**Files:**
- Review: `src/components/OrderProtectionReviewQueue.tsx`
- Review: `src/lib/orderProtectionDisplay.ts`
- Review: `src/test/orderProtectionPage.test.tsx`
- Review: `src/test/orderProtectionDisplay.test.ts`

**Interfaces:**
- Consumes: The completed queue and helper tests from Tasks 1 and 2.
- Produces: A verified, clean working tree ready for review and shipping.

- [ ] **Step 1: Run focused protection tests**

Run: `npm test -- --run src/test/orderProtectionDisplay.test.ts src/test/orderProtectionPage.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run the full verification suite**

Run: `npm test -- --run`

Expected: all tests pass.

Run: `npm run lint`

Expected: 0 errors.

Run: `npm run build`

Expected: production build completes successfully.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Review the final diff**

Run: `git diff origin/main...HEAD -- src/components/OrderProtectionReviewQueue.tsx src/lib/orderProtectionDisplay.ts src/test/orderProtectionPage.test.tsx src/test/orderProtectionDisplay.test.ts`

Confirm that no abandoned queue files, server routes, database schema, credentials, hashes, IP addresses, or non-English UI copy were changed.

- [ ] **Step 4: Commit any final test-only adjustments**

```bash
git status --short
git add src/components/OrderProtectionReviewQueue.tsx src/lib/orderProtectionDisplay.ts src/test/orderProtectionPage.test.tsx src/test/orderProtectionDisplay.test.ts
git commit -m "test: verify order protection queue presentation"
```
