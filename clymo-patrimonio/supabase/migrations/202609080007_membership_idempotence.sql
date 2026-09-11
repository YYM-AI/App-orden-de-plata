-- Repeated seed/authorization does not produce duplicate membership audit events.
create or replace function private.set_membership(h uuid,target uuid,new_role text,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare target_name text; previous public.household_memberships;
begin
 perform private.require_owner(h);
 if new_role not in ('owner','helper') then raise exception 'invalid role' using errcode='23514'; end if;
 select display_name into target_name from public.profiles where id=target and allowlisted;
 if target_name is null then raise exception 'authorized user not found' using errcode='42501'; end if;
 select * into previous from public.household_memberships where household_id=h and user_id=target;
 if previous.id is not null and previous.role=new_role and previous.active=enabled then return; end if;
 insert into public.household_memberships(household_id,user_id,display_name,role,active) values(h,target,target_name,new_role,enabled)
 on conflict(household_id,user_id) do update set role=excluded.role,active=excluded.active;
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),case when not enabled then 'helper_revoked' when previous.id is null then 'helper_authorized' else 'role_changed' end);
end $$;
