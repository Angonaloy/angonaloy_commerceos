# Task 1 Report

## Status

Complete. No remote migration was applied.

## Commit

- `85adb8e feat: add warehouses table and warehouse/weight columns`

## Changes

- Added the org-aware warehouses migration with composite workspace references,
  RLS, service-role-only table/function access, an atomic locked default setter,
  and default seed/repair logic.
- Updated the local baseline verifier to apply active SQL migrations in sorted
  order and assert warehouse RLS and function privileges.
- Added Task 1 schema coverage, including the red-green checks for migration
  creation, lock ordering, and required indexes.

## Verification

- `npm test`: 47 files and 229 tests passed.
- `npm run lint`: completed with 0 errors and 26 pre-existing warnings.
- `npm run build`: passed.
- `npm run verify:supabase-baseline`: two fresh local PostgreSQL resets passed.

## Concerns

- The remote Supabase security advisor reports pre-existing warnings for public
  `rls_auto_enable()` SECURITY DEFINER execution and disabled leaked-password
  protection. Neither was changed by Task 1.
