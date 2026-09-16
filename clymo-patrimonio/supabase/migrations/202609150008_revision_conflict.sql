-- A stale client revision is an application conflict, not a retryable serialization failure.
-- PostgREST 14 retries SQLSTATE 40001 indefinitely. PT409 yields HTTP 409 immediately.
create or replace function private.save_household(h uuid, expected_revision bigint, s jsonb, snapshot jsonb, command_id uuid, action_name text) returns void language plpgsql security definer set search_path='' as $$
declare current_revision bigint;
begin
 perform private.require_owner(h);
 if exists(select 1 from public.command_receipts where id=command_id and household_id=h) then return; end if;
 select revision into current_revision from public.households where id=h;
 if current_revision<>expected_revision then raise exception 'revision conflict' using errcode='PT409'; end if;
 if (s->>'revision')::bigint<>current_revision+1 then raise exception 'revision mismatch' using errcode='23514'; end if;
 perform private.append_state(h,s);
 update public.households set revision=current_revision+1,settings=s->'settings' where id=h;
 perform private.store_valuation(h,current_revision+1,snapshot);
 insert into public.command_receipts(id,household_id,revision) values(command_id,h,current_revision+1);
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),action_name);
end $$;
