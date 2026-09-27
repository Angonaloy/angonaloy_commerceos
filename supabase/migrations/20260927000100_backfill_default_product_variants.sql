-- Every product must have at least one variant: public checkout prices and
-- decrements stock per variant, so a variant-less product cannot be ordered.
-- Give each variant-less product a hidden default variant (empty attributes)
-- seeded from its legacy product-level stock in app_settings. Idempotent.
insert into public.product_variants (product_id, org_id, attributes, cog, stock_quantity, price_adjustment)
select
  p.id,
  p.org_id,
  '{}'::jsonb,
  greatest(coalesce(p.cog, 0), 0),
  greatest(
    coalesce(
      case when s.value ~ '^\s*"?\d+"?\s*$' then nullif(regexp_replace(s.value, '\D', '', 'g'), '')::integer end,
      0
    ),
    0
  ),
  0
from public.products p
left join public.app_settings s
  on s.key = p.org_id::text || ':product_stock:' || p.id::text
where not exists (
  select 1 from public.product_variants v where v.product_id = p.id
);
