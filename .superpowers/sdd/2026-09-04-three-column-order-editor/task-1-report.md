# Task 1 Report — Persist Item Discounts Atomically

## Status

Implementation complete in the assigned files. The migration was not applied remotely. Executable PostgreSQL verification is blocked in this sandbox because `initdb` cannot create its required shared-memory segment.

## RED

Command:

```text
npm test -- src/test/order-items.test.ts
```

Result: exit 1 before test assertions. Vitest collected 36 tests and skipped all 36 because the PostgreSQL harness failed during `beforeAll`:

```text
FATAL: could not create shared memory segment: Operation not permitted
DETAIL: Failed system call was shmget(..., size=56, 03600).
```

This was not a valid feature-level RED, so I also ran:

```text
npx tsc -p tsconfig.app.json --pretty false
```

That produced the expected Task 1 type failure before implementation:

```text
src/test/order-items.test.ts(165,7): error TS2353: Object literal may only specify known properties, and 'discount_type' does not exist in type ...
```

The command also reported unrelated pre-existing TypeScript errors outside the three assigned files.

## GREEN

Command:

```text
npm test -- src/test/order-items.test.ts
```

Result: still exit 1 before assertions for the identical sandbox `initdb`/`shmget` denial. Vitest collected 36 tests and skipped all 36. Therefore the PostgreSQL suite is **not verified GREEN** in this environment.

Additional checks:

- `git diff --check` passed.
- Re-running the app TypeScript check no longer reported any error for `src/test/order-items.test.ts` or `src/integrations/supabase/types.ts`; unrelated repository errors remain.
- `npm run verify:supabase-baseline` was attempted and was blocked by the same `initdb` shared-memory denial.

## Files Changed

- `supabase/migrations/20260904000100_add_order_item_discounts.sql`
  - Adds the three discount columns with defaults and database constraints.
  - Replaces `public.replace_order_items(uuid, uuid, jsonb)` while preserving security-invoker execution, workspace checks, ordered inventory locks, inventory deltas, courier locking, and service-role-only grant.
  - Calculates authoritative fixed/percentage unit discounts, preserves the legacy order-discount remainder, and updates aggregate discount plus net merchandise price atomically.
- `src/integrations/supabase/types.ts`
  - Adds `discount_type`, `discount_value`, and `unit_discount` to `order_items` Row/Insert/Update shapes, with Insert/Update defaults optional.
- `src/test/order-items.test.ts`
  - Applies the new migration in the PostgreSQL harness.
  - Adds schema constraint coverage, fixed/percentage transaction coverage, legacy remainder coverage, and invalid-discount/insufficient-stock rollback checks.

## Self-Review

- Client-provided price and calculated discount are not consumed; unit price is resolved from the workspace-scoped product/variant catalog.
- Fixed discounts above authoritative unit price, negative values, unsupported modes, and percentages above 100 are rejected.
- Existing item discounts are summed before row replacement so only the non-negative legacy remainder is carried forward.
- All order, product, variant, and order-item access inside the transaction retains `org_id` predicates.
- Inventory locks retain deterministic product/variant ordering.
- Any failure remains inside the PostgreSQL transaction and rolls back inventory, item, and order-total changes.
- The function remains `security invoker` with an empty search path; execution remains revoked from public/anon/authenticated and granted to service_role.

## Concerns

- Database behavior and SQL execution still require one run of `npm test -- src/test/order-items.test.ts` in an environment that permits local PostgreSQL shared memory.
- `npm run verify:supabase-baseline` requires the same environment-level rerun.
- The repository currently has unrelated TypeScript errors, so the full app type-check is not globally green.
