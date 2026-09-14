# SDD ledger — plan: /Users/noorkarimmehedi/conductor/repos/mangoloverbd_commerceos/docs/superpowers/plans/2026-08-28-multi-warehouse-and-order-excel-export.md

Base commit: 0815349 chore: establish canonical Supabase schema baseline

Ruling: Route only storefront checkout and social inbox orders — the approved spec says Shopify sync is inactive for this merchant — cost if wrong: later sources will need a small, explicit routing integration.
Ruling: Offer Excel export in both Dashboard Orders and Social Inbox Orders — user selected both — cost if wrong: one extra export surface to maintain.
Ruling: Export exactly selected rows regardless of status — user selected this — cost if wrong: merchants can export undispatched orders with an empty Steadfast ID.
Ruling: Warehouse references must be cross-workspace safe: use composite org-aware foreign keys plus server-side active-warehouse validation for every write — cost if wrong: stale/deleted IDs are rejected rather than silently accepted.
Ruling: Changing the default warehouse must be atomic through a service-role-only database function that locks the org rows — cost if wrong: one more migration function to maintain, avoiding a race that could leave no default.
Ruling: The existing plan's baseline filename is `20260828000000_canonical_schema_reconciliation.sql`; update migration verification to apply the sorted active migration chain — cost if wrong: fresh-schema verification covers the full deploy path.
Ruling: Add DashboardLayout breadcrumbs for both warehouse routes — cost if wrong: one small navigation mapping, avoiding an unnamed page in the existing shell.
Ruling: Correct the Excel row expression with parentheses around the fallback quantity — cost if wrong: prevents a TypeScript parse error.

Task 1: complete (commits 0815349..85adb8e, review clean)
Task 2: fix round 1/5 (3 addressed, 0 open — routing precedence coverage; commits 0a42446..caf0a4b)
Task 2: complete (commits 85adb8e..caf0a4b, review clean)
Task 3: fix round 1/5 (3 addressed, 0 open — atomic default deletion race and input/error hardening; commits ed96ac5..f2d9f0a)
Task 3: complete (commits caf0a4b..f2d9f0a, review clean)
Task 4: fix round 1/5 (1 addressed, 0 open — canonical warehouse ID comparison; commits 2ad43ec..cd1a39d)
Ruling: Task 4 static regression coverage is sufficient — the task's documented convention is source-level route tests; cost if wrong: an unmocked live Supabase uppercase-ID case remains a non-blocking gap.
Task 4: complete (commits f2d9f0a..cd1a39d, review clean)
Ruling: Resolve an unambiguous normalized social product name to its canonical product ID before weight calculation — why: `computeOrderWeightKg` requires an ID or variant; cost if wrong: known social product weights would always be stored as null. Ambiguous normalized names must not route or weigh a product by arbitrary query order.
