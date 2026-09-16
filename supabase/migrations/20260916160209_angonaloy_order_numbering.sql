-- Rebrand order-number allocator from Mango Lover (ML-) to Angonaloy (AG-),
-- and restart the sequence at 1001 as requested. Safe: zero orders existed
-- and the sequence had never been called at the time this was applied.

drop function if exists public.next_ml_order_number();

alter sequence public.orders_order_number_seq restart with 1001;

create function public.next_order_number()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'AG-' || nextval('public.orders_order_number_seq')::text;
$$;

revoke all on function public.next_order_number() from public;
grant execute on function public.next_order_number() to service_role;
