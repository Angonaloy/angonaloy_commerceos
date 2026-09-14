# Task 5 Report

## Files

- `server/index.js`
- `src/test/orderRoutingWiring.test.ts`

## TDD And Verification

- RED: `npx vitest run src/test/orderRoutingWiring.test.ts`
  - Result: failed as expected before implementation: 1 test file failed, 6 tests failed. The first failure was the missing `./warehouseRouting.js` import; the remaining failures confirmed absent resolver, lookup, and snapshot wiring.
- GREEN: `npx vitest run src/test/orderRoutingWiring.test.ts src/test/warehouseRouting.test.ts`
  - Result: passed. 2 test files passed, 21 tests passed.
- `node --check server/index.js`
  - Result: passed with exit code 0 and no output.
- `npm run build`
  - Result: passed. Vite completed the production build in 19.39 seconds.

## Commit

- `118883f feat: route new orders to a warehouse and compute order weight`

## Concerns

- The required safe social-name fallback fetches this org's product candidates and resolves normalized names in JavaScript. This is correct for duplicate-name safety, but a very large catalog may need a future indexed normalized-name representation.
- Vite reported the pre-existing large-chunk warning during the production build. This Task 5 backend and test change does not add frontend bundle code.

## Fix Round 1

### Changes

- Persist `variant_id: order.variant_id || null` in new social inbox order items and use that stored value for routing input.
- Skip fallback name scanning when either a direct product or variant parent resolves, and page the org-scoped candidate scan so ambiguity detection spans all products.

### TDD And Verification

- RED: `npx vitest run src/test/orderRoutingWiring.test.ts`
  - Result: failed as expected after adding persisted-variant and pagination assertions: 1 test file failed, 2 tests failed, 5 tests passed.
- RED: `npx vitest run src/test/orderRoutingWiring.test.ts`
  - Result: failed as expected after adding the valid-variant-parent assertion: 1 test file failed, 2 tests failed, 5 tests passed.
- GREEN: `npx vitest run src/test/orderRoutingWiring.test.ts src/test/warehouseRouting.test.ts`
  - Result: passed. 2 test files passed, 22 tests passed.
- `node --check server/index.js`
  - Result: passed with exit code 0 and no output.
- `npm run build`
  - Result: passed. Vite completed the production build in 1 minute 28 seconds.

### Commit

- `84b7f74 fix: page warehouse routing fallback lookup`

### Concerns

- The fallback scans all current-org products only when an item cannot be resolved by a product or variant ID. This preserves duplicate-name safety but can still be more expensive than an indexed normalized-name lookup for very large catalogs.
- Vite again reported the existing large-chunk warning; this backend and test-only round did not add frontend bundle code.
