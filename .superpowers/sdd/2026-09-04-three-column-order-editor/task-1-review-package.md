# Task 1 review package

Base: cd8e0649f6cb3fa5cdd4adfc7c367a663f28fe37

## Tracked diff

```diff
diff --git a/src/integrations/supabase/types.ts b/src/integrations/supabase/types.ts
index 67a8297..40d5bd1 100644
--- a/src/integrations/supabase/types.ts
+++ b/src/integrations/supabase/types.ts
@@ -379,12 +379,15 @@ export type Database = {
       order_items: {
         Row: {
           created_at: string
+          discount_type: string | null
+          discount_value: number
           id: string
           order_id: string
           org_id: string
           product_id: string | null
           product_name: string
           quantity: number
+          unit_discount: number
           unit_price: number
           updated_at: string
           variant_id: string | null
@@ -392,12 +395,15 @@ export type Database = {
         }
         Insert: {
           created_at?: string
+          discount_type?: string | null
+          discount_value?: number
           id?: string
           order_id: string
           org_id: string
           product_id?: string | null
           product_name: string
           quantity: number
+          unit_discount?: number
           unit_price: number
           updated_at?: string
           variant_id?: string | null
@@ -405,12 +411,15 @@ export type Database = {
         }
         Update: {
           created_at?: string
+          discount_type?: string | null
+          discount_value?: number
           id?: string
           order_id?: string
           org_id?: string
           product_id?: string | null
           product_name?: string
           quantity?: number
+          unit_discount?: number
           unit_price?: number
           updated_at?: string
           variant_id?: string | null
diff --git a/src/test/order-items.test.ts b/src/test/order-items.test.ts
index f4a06c7..23eb2f2 100644
--- a/src/test/order-items.test.ts
+++ b/src/test/order-items.test.ts
@@ -25,6 +25,10 @@ const rpcMigrationPath = join(
   root,
   "supabase/migrations/20260903000100_add_order_item_edit_rpc.sql",
 );
+const discountMigrationPath = join(
+  root,
+  "supabase/migrations/20260904000100_add_order_item_discounts.sql",
+);
 
 function commandPath(name: string): string {
   const configuredBin = process.env.PG_BINDIR;
@@ -127,6 +131,7 @@ beforeAll(() => {
   `);
   applyFile(migrationPath);
   applyFile(rpcMigrationPath);
+  applyFile(discountMigrationPath);
   runSql(`
     update public.products
     set stock_quantity = 10
@@ -157,6 +162,9 @@ describe("order item schema", () => {
       product_name: "Legacy product text",
       variant_name: null,
       unit_price: 100,
+      discount_type: null,
+      discount_value: 0,
+      unit_discount: 0,
       quantity: 1,
       created_at: "2026-09-03T00:00:00Z",
       updated_at: "2026-09-03T00:00:00Z",
@@ -174,6 +182,79 @@ describe("order item schema", () => {
     expect(result).toMatch(/\n\s*0\s*\n/);
   });
 
+  it("rejects negative discount values", () => {
+    expect(() =>
+      runSql(`
+        insert into public.order_items (
+          org_id, order_id, product_name, unit_price, quantity,
+          discount_type, discount_value, unit_discount
+        ) values (
+          '40000000-0000-0000-0000-000000000001',
+          '30000000-0000-0000-0000-000000000001',
+          'Negative entered discount', 5, 1, 'fixed', -1, 0
+        );
+      `),
+    ).toThrow();
+
+    expect(() =>
+      runSql(`
+        insert into public.order_items (
+          org_id, order_id, product_name, unit_price, quantity,
+          discount_type, discount_value, unit_discount
+        ) values (
+          '40000000-0000-0000-0000-000000000001',
+          '30000000-0000-0000-0000-000000000001',
+          'Negative calculated discount', 5, 1, 'fixed', 1, -1
+        );
+      `),
+    ).toThrow();
+  });
+
+  it("rejects unsupported discount types", () => {
+    expect(() =>
+      runSql(`
+        insert into public.order_items (
+          org_id, order_id, product_name, unit_price, quantity,
+          discount_type, discount_value, unit_discount
+        ) values (
+          '40000000-0000-0000-0000-000000000001',
+          '30000000-0000-0000-0000-000000000001',
+          'Unsupported discount', 5, 1, 'coupon', 1, 1
+        );
+      `),
+    ).toThrow();
+  });
+
+  it("rejects percentage discounts above one hundred", () => {
+    expect(() =>
+      runSql(`
+        insert into public.order_items (
+          org_id, order_id, product_name, unit_price, quantity,
+          discount_type, discount_value, unit_discount
+        ) values (
+          '40000000-0000-0000-0000-000000000001',
+          '30000000-0000-0000-0000-000000000001',
+          'Oversized percentage', 5, 1, 'percentage', 100.01, 5
+        );
+      `),
+    ).toThrow();
+  });
+
+  it("rejects calculated discounts above the authoritative unit price", () => {
+    expect(() =>
+      runSql(`
+        insert into public.order_items (
+          org_id, order_id, product_name, unit_price, quantity,
+          discount_type, discount_value, unit_discount
+        ) values (
+          '40000000-0000-0000-0000-000000000001',
+          '30000000-0000-0000-0000-000000000001',
+          'Over-price discount', 5, 1, 'fixed', 5.01, 5.01
+        );
+      `),
+    ).toThrow();
+  });
+
   it("preserves every order and unmatched legacy text", () => {
     const result = runSql(`
       select
@@ -431,7 +512,8 @@ describe("order item replacement service", () => {
       insert into public.order_items (org_id, order_id, product_id, product_name, unit_price, quantity)
       values ('${orgId}', '${orderId}', '${productId}', 'Mango', 5, 1);
       update public.orders set sent_to_courier = false, consignment_id = null,
-        tracking_code = null, courier_status = null, product = 'Mango', quantity = 1, price = 5
+        tracking_code = null, courier_status = null, product = 'Mango', quantity = 1,
+        price = 5, discount = 0
       where id = '${orderId}';
     `);
   });
@@ -472,6 +554,58 @@ describe("order item replacement service", () => {
     expect(result).toMatch(/2\s+\|\s+10\.00/);
   });
 
+  it("calculates fixed and percentage discounts from authoritative catalog prices", () => {
+    const result = runSql(`
+      begin;
+      select public.replace_order_items(
+        '${orgId}',
+        '${orderId}',
+        '[{"productId":"${productId}","quantity":2,"discountType":"fixed","discountValue":1.25},{"variantId":"${variantId}","quantity":1,"discountType":"percentage","discountValue":25}]'
+      );
+      select product_id, variant_id, unit_price, discount_type, discount_value,
+        unit_discount, quantity
+      from public.order_items
+      where order_id = '${orderId}'
+      order by variant_id nulls first;
+      select quantity, price, discount
+      from public.orders
+      where id = '${orderId}';
+      rollback;
+    `);
+
+    expect(result).toMatch(
+      /50000000-0000-0000-0000-000000000001\s+\|\s+\s+\|\s+5\.00\s+\|\s+fixed\s+\|\s+1\.25\s+\|\s+1\.25\s+\|\s+2/,
+    );
+    expect(result).toMatch(
+      /50000000-0000-0000-0000-000000000001\s+\|\s+60000000-0000-0000-0000-000000000001\s+\|\s+6\.00\s+\|\s+percentage\s+\|\s+25\.00\s+\|\s+1\.50\s+\|\s+1/,
+    );
+    expect(result).toMatch(/3\s+\|\s+12\.00\s+\|\s+4\.00/);
+  });
+
+  it("preserves the legacy order discount remainder when replacing discounted items", () => {
+    const result = runSql(`
+      begin;
+      update public.order_items
+      set discount_type = 'fixed', discount_value = 1, unit_discount = 1
+      where order_id = '${orderId}';
+      update public.orders
+      set discount = 3, price = 2
+      where id = '${orderId}';
+
+      select public.replace_order_items(
+        '${orgId}',
+        '${orderId}',
+        '[{"productId":"${productId}","quantity":2,"discountType":"fixed","discountValue":0.5}]'
+      );
+      select price, discount
+      from public.orders
+      where id = '${orderId}';
+      rollback;
+    `);
+
+    expect(result).toMatch(/7\.00\s+\|\s+3\.00/);
+  });
+
   it("loads detail data only for the authenticated workspace", () => {
     const result = runSql(`
       select count(*)
@@ -496,16 +630,38 @@ describe("order item replacement service", () => {
     const result = runSql(`
       begin;
       do $$ begin
-        perform public.replace_order_items('${orgId}', '${orderId}', '[{"productId":"${productId}","quantity":12}]');
+        perform public.replace_order_items('${orgId}', '${orderId}', '[{"productId":"${productId}","quantity":12,"discountType":"fixed","discountValue":1}]');
       exception when others then null;
       end $$;
-      select quantity, price from public.orders where id = '${orderId}';
-      select count(*) from public.order_items where order_id = '${orderId}';
+      select quantity, price, discount from public.orders where id = '${orderId}';
+      select count(*), max(unit_discount) from public.order_items where order_id = '${orderId}';
+      select stock_quantity from public.products where id = '${productId}';
+      rollback;
+    `);
+    expect(result).toMatch(/1\s+\|\s+5\.00\s+\|\s+0\.00/);
+    expect(result).toMatch(/1\s+\|\s+0\.00/);
+    expect(result).toMatch(/10\n/);
+  });
+
+  it("rolls back inventory, items, and order totals when a discount is invalid", () => {
+    const result = runSql(`
+      begin;
+      do $$ begin
+        perform public.replace_order_items(
+          '${orgId}',
+          '${orderId}',
+          '[{"productId":"${productId}","quantity":2,"discountType":"fixed","discountValue":5.01}]'
+        );
+      exception when others then null;
+      end $$;
+      select quantity, price, discount from public.orders where id = '${orderId}';
+      select count(*), max(unit_discount) from public.order_items where order_id = '${orderId}';
       select stock_quantity from public.products where id = '${productId}';
       rollback;
     `);
-    expect(result).toMatch(/1\s+\|\s+5\.00/);
-    expect(result).toMatch(/1\n/);
+
+    expect(result).toMatch(/1\s+\|\s+5\.00\s+\|\s+0\.00/);
+    expect(result).toMatch(/1\s+\|\s+0\.00/);
     expect(result).toMatch(/10\n/);
   });
 

```

## New migration diff

```diff
diff --git a/supabase/migrations/20260904000100_add_order_item_discounts.sql b/supabase/migrations/20260904000100_add_order_item_discounts.sql
new file mode 100644
index 0000000..c1135fe
--- /dev/null
+++ b/supabase/migrations/20260904000100_add_order_item_discounts.sql
@@ -0,0 +1,329 @@
+begin;
+
+alter table public.order_items
+  add column if not exists discount_type text,
+  add column if not exists discount_value numeric(12, 2) not null default 0,
+  add column if not exists unit_discount numeric(12, 2) not null default 0;
+
+alter table public.order_items
+  drop constraint if exists order_items_discount_type_check,
+  drop constraint if exists order_items_discount_value_check,
+  drop constraint if exists order_items_percentage_discount_value_check,
+  drop constraint if exists order_items_fixed_discount_value_check,
+  drop constraint if exists order_items_unit_discount_check;
+
+alter table public.order_items
+  add constraint order_items_discount_type_check
+    check (discount_type is null or discount_type in ('fixed', 'percentage')),
+  add constraint order_items_discount_value_check
+    check (discount_value >= 0),
+  add constraint order_items_percentage_discount_value_check
+    check (discount_type is distinct from 'percentage' or discount_value <= 100),
+  add constraint order_items_fixed_discount_value_check
+    check (discount_type is distinct from 'fixed' or discount_value <= unit_price),
+  add constraint order_items_unit_discount_check
+    check (unit_discount >= 0 and unit_discount <= unit_price);
+
+create or replace function public.replace_order_items(
+  p_org_id uuid,
+  p_order_id uuid,
+  p_items jsonb
+)
+returns void
+language plpgsql
+security invoker
+set search_path = ''
+as $$
+declare
+  locked_order public.orders%rowtype;
+  affected record;
+  old_quantity integer;
+  new_quantity integer;
+  delta integer;
+  available_stock integer;
+  total_quantity integer;
+  gross_subtotal numeric;
+  item_discount_total numeric;
+  aggregate_discount numeric;
+  legacy_discount numeric;
+  product_summary text;
+begin
+  if jsonb_typeof(p_items) <> 'array' then
+    raise exception 'items must be an array' using errcode = '22023';
+  end if;
+
+  -- This lock is the serialization point for dispatch checks and item edits.
+  select * into locked_order
+  from public.orders
+  where id = p_order_id and org_id = p_org_id
+  for update;
+  if not found then
+    raise exception 'order not found' using errcode = 'P0002';
+  end if;
+
+  if locked_order.sent_to_courier
+     or locked_order.consignment_id is not null
+     or locked_order.tracking_code is not null
+     or locked_order.courier_status is not null then
+    raise exception 'order items cannot be edited after courier dispatch' using errcode = 'P0001';
+  end if;
+
+  select greatest(
+    coalesce(locked_order.discount, 0) -
+      coalesce(sum(unit_discount * quantity), 0),
+    0
+  )
+  into legacy_discount
+  from public.order_items
+  where org_id = p_org_id and order_id = p_order_id;
+
+  drop table if exists pg_temp.order_item_edit;
+  create temporary table order_item_edit (
+    product_id uuid,
+    variant_id uuid,
+    quantity integer,
+    discount_type text,
+    discount_value numeric not null default 0,
+    unit_price numeric,
+    unit_discount numeric,
+    unique (product_id, variant_id)
+  ) on commit drop;
+
+  insert into order_item_edit (
+    product_id, variant_id, quantity, discount_type, discount_value
+  )
+  select
+    nullif(element->>'productId', '')::uuid,
+    nullif(element->>'variantId', '')::uuid,
+    (element->>'quantity')::integer,
+    nullif(element->>'discountType', ''),
+    coalesce(nullif(element->>'discountValue', '')::numeric, 0)
+  from jsonb_array_elements(p_items) as elements(element);
+
+  if exists (select 1 from order_item_edit where product_id is null and variant_id is null) then
+    raise exception 'each item requires a productId or variantId' using errcode = '22023';
+  end if;
+  if exists (
+    select 1
+    from order_item_edit
+    group by coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
+             coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
+    having count(*) > 1
+  ) then
+    raise exception 'duplicate order item' using errcode = '23505';
+  end if;
+  if exists (select 1 from order_item_edit where quantity < 1) then
+    raise exception 'item quantity must be positive' using errcode = '22023';
+  end if;
+  if exists (
+    select 1 from order_item_edit
+    where discount_type is not null and discount_type not in ('fixed', 'percentage')
+  ) then
+    raise exception 'unsupported discount type' using errcode = '22023';
+  end if;
+  if exists (select 1 from order_item_edit where discount_value < 0) then
+    raise exception 'discount value must be non-negative' using errcode = '22023';
+  end if;
+  if exists (
+    select 1 from order_item_edit
+    where discount_type = 'percentage' and discount_value > 100
+  ) then
+    raise exception 'percentage discount cannot exceed 100' using errcode = '22023';
+  end if;
+
+  if exists (
+    select 1
+    from order_item_edit as e
+    left join public.products as p on p.id = e.product_id and p.org_id = p_org_id
+    where e.product_id is not null and p.id is null
+  ) then
+    raise exception 'product does not belong to workspace' using errcode = '23503';
+  end if;
+  if exists (
+    select 1
+    from order_item_edit as e
+    left join public.product_variants as v on v.id = e.variant_id and v.org_id = p_org_id
+    where e.variant_id is not null and v.id is null
+  ) then
+    raise exception 'variant does not belong to workspace' using errcode = '23503';
+  end if;
+  if exists (
+    select 1
+    from order_item_edit as e
+    join public.product_variants as v on v.id = e.variant_id and v.org_id = p_org_id
+    where e.product_id is not null and v.product_id <> e.product_id
+  ) then
+    raise exception 'variant does not belong to supplied product' using errcode = '23514';
+  end if;
+
+  update order_item_edit as e
+  set product_id = v.product_id
+  from public.product_variants as v
+  where e.variant_id = v.id and v.org_id = p_org_id and e.product_id is null;
+
+  -- Lock every affected inventory row before calculating any delta.
+  for affected in
+    select distinct product_id
+    from (
+      select product_id from order_item_edit where variant_id is null
+      union all
+      select product_id from public.order_items
+      where org_id = p_org_id and order_id = p_order_id and variant_id is null
+    ) as ids
+    where product_id is not null
+    order by product_id
+  loop
+    perform 1 from public.products where id = affected.product_id and org_id = p_org_id for update;
+  end loop;
+  for affected in
+    select distinct variant_id
+    from (
+      select variant_id from order_item_edit where variant_id is not null
+      union all
+      select variant_id from public.order_items
+      where org_id = p_org_id and order_id = p_order_id and variant_id is not null
+    ) as ids
+    where variant_id is not null
+    order by variant_id
+  loop
+    perform 1 from public.product_variants where id = affected.variant_id and org_id = p_org_id for update;
+  end loop;
+
+  update order_item_edit as e
+  set unit_price = coalesce(p.selling_price, 0) + case
+    when e.variant_id is null then 0
+    else coalesce((
+      select v.price_adjustment
+      from public.product_variants as v
+      where v.id = e.variant_id and v.org_id = p_org_id
+    ), 0)
+  end
+  from public.products as p
+  where p.id = e.product_id and p.org_id = p_org_id;
+
+  if exists (select 1 from order_item_edit where unit_price < 0) then
+    raise exception 'catalog unit price must be non-negative' using errcode = '23514';
+  end if;
+  if exists (
+    select 1 from order_item_edit
+    where discount_type = 'fixed' and discount_value > unit_price
+  ) then
+    raise exception 'fixed discount cannot exceed unit price' using errcode = '22023';
+  end if;
+
+  update order_item_edit
+  set unit_discount = case discount_type
+    when 'fixed' then discount_value
+    when 'percentage' then round(unit_price * discount_value / 100, 2)
+    else 0
+  end;
+
+  for affected in
+    select distinct product_id
+    from (
+      select product_id from order_item_edit where variant_id is null
+      union all
+      select product_id from public.order_items
+      where org_id = p_org_id and order_id = p_order_id and variant_id is null
+    ) as ids
+    where product_id is not null
+    order by product_id
+  loop
+    select coalesce(sum(quantity), 0) into old_quantity
+    from public.order_items
+    where org_id = p_org_id and order_id = p_order_id
+      and product_id = affected.product_id and variant_id is null;
+    select coalesce(sum(quantity), 0) into new_quantity
+    from order_item_edit
+    where product_id = affected.product_id and variant_id is null;
+    delta := new_quantity - old_quantity;
+    select stock_quantity into available_stock
+    from public.products
+    where id = affected.product_id and org_id = p_org_id;
+    if delta > available_stock then
+      raise exception 'insufficient stock for product %', affected.product_id using errcode = 'P0001';
+    end if;
+    update public.products
+    set stock_quantity = stock_quantity - delta
+    where id = affected.product_id and org_id = p_org_id;
+  end loop;
+
+  for affected in
+    select distinct variant_id
+    from (
+      select variant_id from order_item_edit where variant_id is not null
+      union all
+      select variant_id from public.order_items
+      where org_id = p_org_id and order_id = p_order_id and variant_id is not null
+    ) as ids
+    where variant_id is not null
+    order by variant_id
+  loop
+    select coalesce(sum(quantity), 0) into old_quantity
+    from public.order_items
+    where org_id = p_org_id and order_id = p_order_id and variant_id = affected.variant_id;
+    select coalesce(sum(quantity), 0) into new_quantity
+    from order_item_edit
+    where variant_id = affected.variant_id;
+    delta := new_quantity - old_quantity;
+    select stock_quantity into available_stock
+    from public.product_variants
+    where id = affected.variant_id and org_id = p_org_id;
+    if delta > available_stock then
+      raise exception 'insufficient stock for variant %', affected.variant_id using errcode = 'P0001';
+    end if;
+    update public.product_variants
+    set stock_quantity = stock_quantity - delta
+    where id = affected.variant_id and org_id = p_org_id;
+  end loop;
+
+  delete from public.order_items where org_id = p_org_id and order_id = p_order_id;
+  insert into public.order_items (
+    org_id, order_id, product_id, variant_id, product_name, variant_name,
+    unit_price, discount_type, discount_value, unit_discount, quantity
+  )
+  select
+    p_org_id,
+    p_order_id,
+    e.product_id,
+    e.variant_id,
+    p.name,
+    case when v.id is null then null else v.attributes::text end,
+    e.unit_price,
+    e.discount_type,
+    e.discount_value,
+    e.unit_discount,
+    e.quantity
+  from order_item_edit as e
+  join public.products as p on p.id = e.product_id and p.org_id = p_org_id
+  left join public.product_variants as v on v.id = e.variant_id and v.org_id = p_org_id;
+
+  select
+    coalesce(sum(quantity), 0),
+    coalesce(sum(unit_price * quantity), 0),
+    coalesce(sum(unit_discount * quantity), 0),
+    string_agg(format('%sx %s', quantity, product_name), ' + ' order by id)
+  into total_quantity, gross_subtotal, item_discount_total, product_summary
+  from public.order_items
+  where org_id = p_org_id and order_id = p_order_id;
+
+  aggregate_discount := legacy_discount + item_discount_total;
+  if aggregate_discount > gross_subtotal then
+    raise exception 'aggregate discount cannot exceed merchandise subtotal' using errcode = '22023';
+  end if;
+
+  update public.orders
+  set quantity = total_quantity,
+      price = gross_subtotal - aggregate_discount,
+      discount = aggregate_discount,
+      product = product_summary
+  where id = p_order_id and org_id = p_org_id;
+end;
+$$;
+
+revoke execute on function public.replace_order_items(uuid, uuid, jsonb) from public, anon, authenticated;
+grant execute on function public.replace_order_items(uuid, uuid, jsonb) to service_role;
+
+notify pgrst, 'reload schema';
+
+commit;

```

