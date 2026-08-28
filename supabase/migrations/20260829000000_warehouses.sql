-- Warehouses are org-scoped routing labels, not inventory locations. Stock
-- remains one number per product or variant.

begin;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  address text,
  contact_person text,
  phone text,
  is_default boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);

create unique index warehouses_org_name_idx
on public.warehouses (org_id, name)
where deleted_at is null;

create unique index warehouses_org_default_idx
on public.warehouses (org_id)
where is_default and deleted_at is null;

create index warehouses_org_listing_idx
on public.warehouses (org_id, deleted_at, created_at desc);

drop trigger if exists update_warehouses_updated_at on public.warehouses;
create trigger update_warehouses_updated_at
before update on public.warehouses
for each row execute function public.update_updated_at_column();

alter table public.products add column warehouse_id uuid;
alter table public.products add column weight_kg numeric(10, 3)
  check (weight_kg is null or weight_kg >= 0);
alter table public.products
  add constraint products_org_warehouse_id_fkey
  foreign key (org_id, warehouse_id)
  references public.warehouses (org_id, id);

alter table public.product_variants add column weight_kg numeric(10, 3)
  check (weight_kg is null or weight_kg >= 0);

alter table public.orders add column warehouse_id uuid;
alter table public.orders add column warehouse_auto boolean not null default true;
alter table public.orders add column weight_kg numeric(10, 3)
  check (weight_kg is null or weight_kg >= 0);
alter table public.orders
  add constraint orders_org_warehouse_id_fkey
  foreign key (org_id, warehouse_id)
  references public.warehouses (org_id, id);

alter table public.social_inbox_orders add column warehouse_id uuid;
alter table public.social_inbox_orders add column warehouse_auto boolean not null default true;
alter table public.social_inbox_orders add column weight_kg numeric(10, 3)
  check (weight_kg is null or weight_kg >= 0);
alter table public.social_inbox_orders
  add constraint social_inbox_orders_org_warehouse_id_fkey
  foreign key (org_id, warehouse_id)
  references public.warehouses (org_id, id);

create index products_org_warehouse_idx on public.products (org_id, warehouse_id);
create index orders_org_warehouse_created_idx
on public.orders (org_id, warehouse_id, created_at desc);
create index social_inbox_orders_org_warehouse_idx
on public.social_inbox_orders (org_id, warehouse_id, created_at desc);

-- Ensure every existing workspace has an active Mango Lover warehouse before
-- choosing one default. The two-step repair avoids transient partial-index
-- conflicts when an existing default is replaced.
insert into public.warehouses (org_id, name, is_default)
select orgs.org_id, 'Mango Lover', false
from (
  select distinct org_id
  from public.user_roles
  where org_id is not null
) as orgs
where not exists (
  select 1
  from public.warehouses as warehouse
  where warehouse.org_id = orgs.org_id
    and warehouse.name = 'Mango Lover'
    and warehouse.deleted_at is null
);

update public.warehouses as warehouse
set is_default = false
where warehouse.org_id in (
  select distinct org_id
  from public.user_roles
  where org_id is not null
)
  and warehouse.is_default;

with ranked_warehouses as (
  select
    warehouse.org_id,
    warehouse.id,
    row_number() over (
      partition by warehouse.org_id
      order by
        case when warehouse.name = 'Mango Lover' then 0 else 1 end,
        warehouse.created_at,
        warehouse.id
    ) as default_rank
  from public.warehouses as warehouse
  inner join (
    select distinct org_id
    from public.user_roles
    where org_id is not null
  ) as orgs on orgs.org_id = warehouse.org_id
  where warehouse.deleted_at is null
)
update public.warehouses as warehouse
set is_default = true
from ranked_warehouses
where warehouse.org_id = ranked_warehouses.org_id
  and warehouse.id = ranked_warehouses.id
  and ranked_warehouses.default_rank = 1;

create function public.set_default_warehouse(p_org_id uuid, p_warehouse_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
begin
  -- Lock every warehouse for the workspace so clear-and-set is atomic.
  perform 1
  from public.warehouses as warehouse
  where warehouse.org_id = p_org_id
  order by warehouse.id
  for update;

  select warehouse.id
  into v_warehouse_id
  from public.warehouses as warehouse
  where warehouse.org_id = p_org_id
    and warehouse.id = p_warehouse_id
    and warehouse.deleted_at is null
  for update;

  if v_warehouse_id is null then
    raise exception 'Warehouse % is not active in workspace %', p_warehouse_id, p_org_id
      using errcode = 'P0002';
  end if;

  update public.warehouses as warehouse
  set is_default = false
  where warehouse.org_id = p_org_id
    and warehouse.is_default
    and warehouse.id <> p_warehouse_id;

  update public.warehouses as warehouse
  set is_default = true
  where warehouse.org_id = p_org_id
    and warehouse.id = p_warehouse_id
    and warehouse.deleted_at is null;
end;
$$;

alter table public.warehouses enable row level security;
revoke all on table public.warehouses from public, anon, authenticated;
grant all on table public.warehouses to service_role;

revoke all on function public.set_default_warehouse(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.set_default_warehouse(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
