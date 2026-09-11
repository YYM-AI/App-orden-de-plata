create function private.check_actor() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is null or new.payload->>'actorId' is distinct from auth.uid()::text then raise exception 'actor mismatch' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.check_actor() from public,anon,authenticated;
create trigger verify_actor before insert on public.ownership_decisions for each row execute function private.check_actor();
create trigger verify_actor before insert on public.inclusion_decisions for each row execute function private.check_actor();
create trigger verify_actor before insert on public.obligation_events for each row execute function private.check_actor();
create trigger verify_actor before insert on public.resolution_decisions for each row execute function private.check_actor();
