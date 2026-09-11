alter table public.profiles add column deletion_requested_at timestamptz;
alter table private.deletion_receipts add column phase text not null default 'completed' check(phase in ('requested','completed'));
create or replace function private.prepare_account_deletion() returns void language plpgsql security definer set search_path='' as $$
declare h record;
begin
 perform private.require_recent();
 for h in select household_id from public.household_memberships where user_id=auth.uid() and active order by household_id loop perform 1 from public.households where id=h.household_id for update; end loop;
 delete from public.household_memberships where user_id=auth.uid();
 update public.profiles set allowlisted=false,deletion_requested_at=now() where id=auth.uid();
 insert into private.deletion_receipts(actor_id,kind,phase) values(auth.uid(),'account','requested');
end $$;
create function private.account_deletion_complete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update private.deletion_receipts set phase='completed',completed_at=now() where actor_id=old.id and kind='account' and phase='requested';
 return old;
end $$;
revoke all on function private.account_deletion_complete() from public,anon,authenticated;
create trigger clymo_account_deleted after delete on auth.users for each row execute function private.account_deletion_complete();
-- A read uses one MVCC snapshot across all entity arrays.
alter function public.read_household(uuid) stable;
