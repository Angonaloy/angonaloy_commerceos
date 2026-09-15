# Execution Addendum

This addendum overrides the implementation plan only where the audit found a correctness or scope gap.

## Task 1: Schema and migration verification

- Create `supabase/migrations/20260829000000_warehouses.sql` after the canonical reconciliation migration.
- Treat warehouses as org-scoped routing labels, never inventory locations.
- Add `unique (org_id, id)` to `warehouses` so the warehouse references below can enforce workspace membership at the database layer.
- Add nullable `warehouse_id` columns and composite foreign keys `(org_id, warehouse_id) references warehouses (org_id, id)` on `products`, `orders`, and `social_inbox_orders`.
- Enable RLS, revoke anon/authenticated table privileges, grant service_role table privileges, and issue `notify pgrst, 'reload schema'` for the new table.
- Add a `public.set_default_warehouse(p_org_id uuid, p_warehouse_id uuid)` PL/pgSQL function. It locks that org's warehouse rows with `FOR UPDATE`, rejects a missing/deleted warehouse, clears the old default, sets the requested default, uses a fixed search path, revokes PUBLIC/anon/authenticated execute, and grants execute only to service_role.
- Seed and repair exactly one active default warehouse per `user_roles.org_id`, preferring the active `Angonaloy` row. Do not rely only on `on conflict do nothing`.
- Update `scripts/verify-supabase-baseline.mjs` and its tests so all active SQL migrations are applied in filename order. Update runtime-table/RLS assertions for `warehouses` and verify the default-setting function is unavailable to browser roles.

## API write safety

- Create one server helper that resolves an active, non-deleted warehouse by `id` and current `orgId`.
- Use it before every non-null warehouse write: create/edit product, bulk product assignment, order override, and social-inbox-order override.
- Replace the plan's non-atomic clear-then-set-default route logic with `supabase.rpc("set_default_warehouse", { p_org_id: orgId, p_warehouse_id: warehouseId })`.

## Routing

- Keep routing to storefront checkout and social inbox only.
- Fix name fallback by fetching candidates within the current org and matching normalized names in JavaScript; do not issue an exact `.in("name", names)` query before case-insensitive normalization.

## Frontend completeness

- Add warehouse breadcrumb labels for `/warehouses` and `/warehouses/:id` in `src/components/DashboardLayout.tsx`.
- Add Excel export to Social Inbox selections as well as `OrdersTable` selections. Parse the existing `notes` representation if it remains the source of inbox phone/address.

## Excel

- Change `order.quantity ?? itemsQuantity(order.items) || ""` to `order.quantity ?? (itemsQuantity(order.items) || "")`.
