alter table public.order_protection_reviews
  add column if not exists contact_status text;

update public.order_protection_reviews
set contact_status = 'open'
where contact_status is null;

alter table public.order_protection_reviews
  alter column contact_status set default 'open',
  alter column contact_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_protection_reviews'::regclass
      and conname = 'order_protection_reviews_contact_status_check'
  ) then
    alter table public.order_protection_reviews
      add constraint order_protection_reviews_contact_status_check
      check (contact_status in ('open', 'contacted'));
  end if;
end
$$;
