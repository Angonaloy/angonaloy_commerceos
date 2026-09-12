# Order Protection Abandoned-Style Queue Design

## Goal

Make the Order Protection review queue use the same row layout and interaction language as the Dashboard's Abandoned queue, while keeping protection-specific review information and actions visible.

## Scope

### In scope

- Restyle `OrderProtectionReviewQueue` to match the abandoned queue's row structure, spacing, typography, chips, and responsive behavior.
- Keep the queue header and loading, error, and empty states in the existing Order Protection page.
- Add the abandoned-row actions: Call, WhatsApp, Copy, and contact-status dropdown.
- Keep Accept and Reject as protection-specific per-row actions.
- Show risk score and risk reasons in the row.
- Render each cart item on its own line with quantity, product name, optional variant, and optional price.
- Keep all existing protection API calls, authorization behavior, and review transitions unchanged.

### Out of scope

- No changes to the order-protection database schema or server routes.
- No bulk Accept or Reject actions.
- No Dismiss action; Reject is the explicit negative decision.
- No changes to the abandoned checkout queue.
- No changes to how risk scores or reason codes are calculated.

## UI design

Each review row follows the abandoned queue's responsive three-column layout:

1. A selectable checkbox on the left, including a select-all control in the queue header for visual and interaction parity.
2. The customer content in the middle: customer name, `On hold` badge, source route, captured time, total, phone, address, risk information, and a multi-line item list.
3. The action area on the right on large screens and below the content on small screens.

The action area contains, when the data is available:

- Call
- WhatsApp
- Copy
- Contact status (`Awaiting contact` / `Contacted`)
- Accept
- Reject

Accept and Reject remain visually distinct from contact actions. Accept uses the existing success chip treatment; Reject uses the neutral treatment.

Risk information is displayed without changing the abandoned row's hierarchy:

- `Risk score` is a compact numeric chip/value near the customer summary.
- `Risk reasons` are readable rose chips, one for each reason code.

Cart items are rendered individually. A line uses the format `2 × Product name — Variant`, with the variant omitted when absent. Price is shown only when present in the protection payload. The total is computed from item prices and quantities when possible; otherwise it is displayed as an em dash.

## Component and data design

Keep `AbandonedCheckoutQueue` as the source of the visual recipe but do not change its public API. Add small local protection helpers for:

- Formatting the source route and capture time.
- Formatting phone and WhatsApp links.
- Computing a safe total from unknown item payloads.
- Normalizing product name, variant name, quantity, and unit price from the stored item records.

`OrderProtectionReviewQueue` owns only presentation state and row interaction state:

- selected review IDs
- copied field/summary state
- contact-status state used by the existing review row UI
- the existing loading/error/busy state

The current protection API has no contact-status action. The contact-status dropdown is therefore local presentation state for the current page session and never writes to the abandoned-checkout API.

Accept and Reject continue using `updateProtectionReview(reviewId, action)`. Resolved reviews are removed from the local queue after a successful response.

## Accessibility and responsive behavior

- Preserve semantic buttons, links, labels, keyboard activation, focus rings, and disabled/busy states from the abandoned queue.
- Keep phone and WhatsApp actions hidden when no valid phone number is available.
- Keep the row readable on mobile by wrapping content and moving actions below the customer block.
- Keep each product line distinct so quantity is never hidden in a summary string.
- Do not expose hashes, IP addresses, or other internal protection signals in the UI.

## Testing

Update the Order Protection page tests to verify:

- abandoned-style customer and action controls render;
- each product line includes its quantity, name, variant, and price when available;
- risk score and all risk reasons render;
- Accept and Reject still call the existing protection mutation and remove the row;
- missing phone or item price safely omits the corresponding optional UI;
- Reject still uses the existing protection mutation and removes the review after success.

Run the full Vitest suite, lint, build, and `git diff --check` before shipping.
