-- Narrow, authenticated operations. Definer functions live outside PostgREST's exposed schemas.
create function private.entity_tables() returns table(state_key text, table_name text) language sql immutable set search_path='' as $$ values
('financialParties','financial_parties'),
('institutions','institutions'),
('instruments','instruments'),
('accounts','logical_accounts'),
('sourceBindings','account_source_bindings'),
('balances','balance_observations'),
('positions','position_observations'),
('prices','price_observations'),
('rates','exchange_rates'),
('ufValues','uf_values'),
('ownershipDecisions','ownership_decisions'),
('inclusionDecisions','inclusion_decisions'),
('manualAssets','manual_assets'),
('liabilities','liabilities'),
('obligations','obligations'),
('obligationEvents','obligation_events'),
('duplicates','duplicate_candidates'),
('reviewTasks','review_tasks'),
('resolutions','resolution_decisions') $$;
revoke all on function private.entity_tables() from public,anon;
grant execute on function private.entity_tables() to authenticated;
create or replace function private.immutable_evidence() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' and current_user='postgres' and current_setting('clymo.delete_household',true)=old.household_id::text then return old; end if;
 raise exception 'immutable evidence' using errcode='42501';
end $$;
create function private.require_owner(h uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(h,true) then raise exception 'access denied' using errcode='42501'; end if;
 perform 1 from public.households where id=h for update;
 -- Recheck after acquiring the household lock: revocation and writes serialize.
 if not private.has_role(h,true) then raise exception 'access denied' using errcode='42501'; end if;
end $$;
create function private.require_recent() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.allowed() or not exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and s.created_at>now()-interval '10 minutes') then
  raise exception 'recent sign in required' using errcode='42501';
 end if;
end $$;
create function private.guard_last_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='owner' and old.active and (TG_OP='DELETE' or new.role<>'owner' or not new.active) then
  perform 1 from public.households where id=old.household_id for update;
  if exists(select 1 from public.households where id=old.household_id) and not exists(select 1 from public.household_memberships m where m.household_id=old.household_id and m.active and m.role='owner' and m.id<>old.id) then
   raise exception 'last owner cannot be removed' using errcode='23514';
  end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create trigger last_owner before update or delete on public.household_memberships for each row execute function private.guard_last_owner();
create function private.check_evidence() returns trigger language plpgsql set search_path='' as $$
declare binding jsonb; acc jsonb; instrument jsonb; obligation jsonb; outstanding numeric; prior timestamptz;
begin
 if new.payload ? 'effectiveDate' then
  if new.effective_at is distinct from ((new.payload->>'effectiveDate')||'T00:00:00Z')::timestamptz or new.recorded_at is distinct from (new.payload->>'recordedAt')::timestamptz then raise exception 'date mismatch' using errcode='23514'; end if;
 end if;
 if TG_TABLE_NAME in ('balance_observations','position_observations') then
  select a.payload into acc from public.logical_accounts a where a.household_id=new.household_id and a.domain_key=new.payload->>'accountId';
  select b.payload into binding from public.account_source_bindings b where b.household_id=new.household_id and b.domain_key=new.payload->>'bindingId';
  if binding->>'accountId' is not null and binding->>'accountId'<>new.payload->>'accountId' then raise exception 'source account mismatch' using errcode='23514'; end if;
  if TG_TABLE_NAME='balance_observations' and acc->>'currency'<>new.payload->>'currency' then raise exception 'currency mismatch' using errcode='23514'; end if;
  if TG_TABLE_NAME='position_observations' then
   select i.payload into instrument from public.instruments i where i.household_id=new.household_id and i.domain_key=new.payload->>'instrumentId';
   if instrument->>'currency'<>acc->>'currency' then raise exception 'currency mismatch' using errcode='23514'; end if;
  end if;
 end if;
 if TG_TABLE_NAME='price_observations' then
  select i.payload into instrument from public.instruments i where i.household_id=new.household_id and i.domain_key=new.payload->>'instrumentId';
  if instrument->>'currency'<>new.payload->>'currency' then raise exception 'price currency mismatch' using errcode='23514'; end if;
 end if;
 if TG_TABLE_NAME='obligation_events' then
  select o.payload into obligation from public.obligations o where o.household_id=new.household_id and o.domain_key=new.payload->>'obligationId' for update;
  if obligation->>'currency'<>new.payload->>'currency' then raise exception 'obligation currency mismatch' using errcode='23514'; end if;
  select max(e.effective_at),coalesce(sum(case when e.payload->>'kind'='initial' then e.financial_value when e.payload->>'kind'='adjustment' and e.payload->>'adjustmentDirection'='increase' then e.financial_value when e.payload->>'kind'='dispute' then 0 else -e.financial_value end),0) into prior,outstanding from public.obligation_events e where e.household_id=new.household_id and e.payload->>'obligationId'=new.payload->>'obligationId';
  if new.effective_at<prior or (prior is null and new.payload->>'kind'<>'initial') then raise exception 'invalid event order' using errcode='23514'; end if;
  if new.payload->>'kind'='dispute' and (new.payload->>'amount')::numeric<>0 then raise exception 'dispute amount must be zero' using errcode='23514'; end if;
  if new.payload->>'kind'='adjustment' and coalesce(new.payload->>'adjustmentDirection','') not in ('increase','decrease') then raise exception 'invalid adjustment direction' using errcode='23514'; end if;
  if new.payload->>'kind' in ('repayment','settlement','forgiveness','write_off') or (new.payload->>'kind'='adjustment' and new.payload->>'adjustmentDirection'='decrease') then
   if (new.payload->>'amount')::numeric<=0 or (new.payload->>'amount')::numeric>outstanding then raise exception 'invalid repayment' using errcode='23514'; end if;
  end if;
  if new.payload->>'kind'='settlement' and (new.payload->>'amount')::numeric<>outstanding then raise exception 'settlement must cover outstanding' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger validate_evidence before insert on public.balance_observations for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.position_observations for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.price_observations for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.exchange_rates for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.uf_values for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.ownership_decisions for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.inclusion_decisions for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.obligation_events for each row execute function private.check_evidence();
create trigger validate_evidence before insert on public.resolution_decisions for each row execute function private.check_evidence();

create function public.read_household(p_household uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.households; result jsonb; e record; rows jsonb; users_json jsonb;
begin
 if not private.has_role(p_household) then raise exception 'access denied' using errcode='42501'; end if;
 select * into strict h from public.households where id=p_household;
 result=jsonb_build_object('schemaVersion',1,'revision',h.revision,'cutoff',to_char(h.cutoff at time zone 'UTC','YYYY-MM-DD'),'household',jsonb_build_object('id',h.id,'name',h.name,'synthetic',true),'policy',h.policy,'settings',h.settings);
 for e in select * from private.entity_tables() loop
  execute format('select coalesce(jsonb_agg(payload order by ordinal),''[]''::jsonb) from public.%I where household_id=$1',e.table_name) into rows using p_household;
  result=result||jsonb_build_object(e.state_key,rows);
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'householdId',m.household_id,'userId',m.user_id,'role',case when m.role='owner' then 'admin' else 'viewer' end,'active',m.active) order by m.created_at,m.id),'[]') into rows from public.household_memberships m where m.household_id=p_household;
 result=result||jsonb_build_object('memberships',rows);
 select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'displayName',display_name)),'[]') into users_json from public.household_memberships where household_id=p_household;
 -- Historical actor UUIDs remain detached pseudonymous evidence after account removal.
 for e in select distinct value->>'actorId' actor from jsonb_array_elements((result->'ownershipDecisions')||(result->'inclusionDecisions')||(result->'obligationEvents')||(result->'resolutions')) where value ? 'actorId' loop
  if not exists(select 1 from jsonb_array_elements(users_json) u where u->>'id'=e.actor) then users_json=users_json||jsonb_build_array(jsonb_build_object('id',e.actor,'displayName','Participante anterior')); end if;
 end loop;
 select coalesce(jsonb_agg(id::text order by created_at,id),'[]') into rows from public.command_receipts where household_id=p_household;
 return result||jsonb_build_object('users',users_json,'appliedCommands',rows);
end $$;
create function private.append_state(h uuid, s jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e record; item jsonb; old_payload jsonb; effective timestamptz; recorded timestamptz; existing_count integer;
begin
 if s->'household'->>'id'<>h::text or s->'household'->>'synthetic'<>'true' then raise exception 'household mismatch' using errcode='23514'; end if;
 for e in select * from private.entity_tables() loop
  if jsonb_typeof(s->e.state_key)<>'array' then raise exception 'missing entity array' using errcode='23514'; end if;
  execute format('select count(*) from public.%I where household_id=$1 and not exists(select 1 from jsonb_array_elements($2) v where v->>''id''=domain_key)',e.table_name) into existing_count using h,s->e.state_key;
  if existing_count>0 then raise exception 'history cannot be removed' using errcode='23514'; end if;
  for item in select value from jsonb_array_elements(s->e.state_key) loop
   execute format('select payload from public.%I where household_id=$1 and domain_key=$2',e.table_name) into old_payload using h,item->>'id';
   if old_payload is not null then
    if old_payload<>item then raise exception 'history cannot be rewritten' using errcode='23514'; end if;
   else
    if item ? 'effectiveDate' then
     effective=((item->>'effectiveDate')||'T00:00:00Z')::timestamptz; recorded=(item->>'recordedAt')::timestamptz;
     execute format('insert into public.%I(id,household_id,domain_key,payload,effective_at,recorded_at) values(private.entity_id($1,$2),$1,$2,$3,$4,$5)',e.table_name) using h,item->>'id',item,effective,recorded;
    else
     execute format('insert into public.%I(id,household_id,domain_key,payload) values(private.entity_id($1,$2),$1,$2,$3)',e.table_name) using h,item->>'id',item;
    end if;
   end if;
  end loop;
 end loop;
end $$;
create function private.store_valuation(h uuid, revision bigint, snapshot jsonb) returns void language plpgsql security definer set search_path='' as $$
declare run uuid; c jsonb; a numeric; l numeric;
begin
 insert into public.valuation_runs(household_id,revision,policy_version,reporting_currency) values(h,revision,snapshot->>'policyVersion',snapshot->>'reportingCurrency') returning id into run;
 for c in select value from jsonb_array_elements(snapshot->'components') loop
  insert into public.valuation_components(household_id,run_id,account_id,original_amount,reporting_value,included,side,payload) values(h,run,private.entity_id(h,c->>'accountId'),(c->>'originalAmount')::numeric,(c->>'reportingValue')::numeric,(c->>'included')::boolean,c->>'side',c);
 end loop;
 select coalesce(sum(reporting_value) filter(where included and side='asset'),0),coalesce(sum(reporting_value) filter(where included and side='liability'),0) into a,l from public.valuation_components where run_id=run;
 if a<>(snapshot->>'assets')::numeric or l<>(snapshot->>'liabilities')::numeric then raise exception 'snapshot component mismatch' using errcode='23514'; end if;
 insert into public.net_worth_snapshots(household_id,run_id,assets,liabilities,net_worth,liquid_cash) values(h,run,a,l,(snapshot->>'netWorth')::numeric,(snapshot->>'liquidCash')::numeric);
end $$;
create function private.save_household(h uuid, expected_revision bigint, s jsonb, snapshot jsonb, command_id uuid, action_name text) returns void language plpgsql security definer set search_path='' as $$
declare current_revision bigint;
begin
 perform private.require_owner(h);
 if exists(select 1 from public.command_receipts where id=command_id and household_id=h) then return; end if;
 select revision into current_revision from public.households where id=h;
 if current_revision<>expected_revision then raise exception 'revision conflict' using errcode='40001'; end if;
 if (s->>'revision')::bigint<>current_revision+1 then raise exception 'revision mismatch' using errcode='23514'; end if;
 perform private.append_state(h,s);
 update public.households set revision=current_revision+1,settings=s->'settings' where id=h;
 perform private.store_valuation(h,current_revision+1,snapshot);
 insert into public.command_receipts(id,household_id,revision) values(command_id,h,current_revision+1);
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),action_name);
end $$;
create function public.save_household(p_household uuid,p_expected_revision bigint,p_state jsonb,p_snapshot jsonb,p_command_id uuid,p_action text) returns void language sql security invoker set search_path='' as $$
 select private.save_household(p_household,p_expected_revision,p_state,p_snapshot,p_command_id,p_action)
$$;
create function private.clear_financial_rows(h uuid) returns void language plpgsql security definer set search_path='' as $$
declare e record;
begin
 perform set_config('clymo.delete_household',h::text,true);
 delete from public.net_worth_snapshots where household_id=h;
 delete from public.valuation_components where household_id=h;
 delete from public.valuation_runs where household_id=h;
 delete from public.command_receipts where household_id=h;
 for e in select * from private.entity_tables() loop execute format('delete from public.%I where household_id=$1',e.table_name) using h; end loop;
 perform set_config('clymo.delete_household','',true);
end $$;
create function private.reset_household(h uuid,s jsonb,snapshot jsonb) returns void language plpgsql security definer set search_path='' as $$
declare next_revision bigint;
begin
 perform private.require_owner(h);
 select revision+1 into next_revision from public.households where id=h;
 perform private.clear_financial_rows(h);
 perform private.append_state(h,s);
 update public.households set revision=next_revision,settings=s->'settings',seeded=true where id=h;
 perform private.store_valuation(h,next_revision,snapshot);
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),'fixture_reset');
end $$;
create function public.reset_household(p_household uuid,p_state jsonb,p_snapshot jsonb) returns void language sql security invoker set search_path='' as $$ select private.reset_household(p_household,p_state,p_snapshot) $$;
create function private.set_membership(h uuid,target uuid,new_role text,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare target_name text; previous public.household_memberships;
begin
 perform private.require_owner(h);
 if new_role not in ('owner','helper') then raise exception 'invalid role' using errcode='23514'; end if;
 select display_name into target_name from public.profiles where id=target and allowlisted;
 if target_name is null then raise exception 'authorized user not found' using errcode='42501'; end if;
 select * into previous from public.household_memberships where household_id=h and user_id=target;
 insert into public.household_memberships(household_id,user_id,display_name,role,active) values(h,target,target_name,new_role,enabled)
 on conflict(household_id,user_id) do update set role=excluded.role,active=excluded.active;
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),case when not enabled then 'helper_revoked' when previous.id is null then 'helper_authorized' else 'role_changed' end);
end $$;
create function public.set_membership(p_household uuid,p_user uuid,p_role text,p_active boolean) returns void language sql security invoker set search_path='' as $$ select private.set_membership(p_household,p_user,p_role,p_active) $$;
create function private.delete_household(h uuid,confirmation text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_owner(h); perform private.require_recent();
 if not exists(select 1 from public.households where id=h and name=confirmation) then raise exception 'confirmation mismatch' using errcode='23514'; end if;
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),'deletion_requested');
 perform set_config('clymo.delete_household',h::text,true);
 delete from public.households where id=h;
 perform set_config('clymo.delete_household','',true);
 insert into private.deletion_receipts(actor_id,kind) values(auth.uid(),'household');
end $$;
create function public.delete_household(p_household uuid,p_confirmation text) returns void language sql security invoker set search_path='' as $$ select private.delete_household(p_household,p_confirmation) $$;
create function private.prepare_account_deletion() returns void language plpgsql security definer set search_path='' as $$
declare h record;
begin
 perform private.require_recent();
 for h in select household_id from public.household_memberships where user_id=auth.uid() and active order by household_id loop perform 1 from public.households where id=h.household_id for update; end loop;
 -- The last-owner trigger prevents orphaning any household and rolls this transaction back.
 delete from public.household_memberships where user_id=auth.uid();
 update public.profiles set allowlisted=false where id=auth.uid();
 insert into private.deletion_receipts(actor_id,kind) values(auth.uid(),'account');
end $$;
create function public.prepare_account_deletion() returns void language sql security invoker set search_path='' as $$ select private.prepare_account_deletion() $$;
create function private.record_audit(h uuid,event_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 if event_name in ('export_json','export_csv') then perform private.require_owner(h);
 elsif event_name='session' and private.has_role(h) then null;
 else raise exception 'access denied' using errcode='42501'; end if;
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),event_name);
end $$;
create function public.record_audit(p_household uuid,p_event text) returns void language sql security invoker set search_path='' as $$ select private.record_audit(p_household,p_event) $$;
create view public.account_inventory with(security_invoker=true) as select a.id,a.household_id,a.domain_key,a.payload->>'name' as name,i.payload->>'name' as institution from public.logical_accounts a join public.institutions i on a.household_id=i.household_id and a.institution_id=i.id;
revoke all on public.account_inventory from anon,authenticated;
grant select on public.account_inventory to authenticated;
-- Deny all private functions by default, then grant only the small functions used by wrappers/policies.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.entity_id(uuid,text),private.entity_tables(),private.allowed(),private.has_role(uuid,boolean) to authenticated;
grant execute on function private.save_household(uuid,bigint,jsonb,jsonb,uuid,text),private.reset_household(uuid,jsonb,jsonb),private.set_membership(uuid,uuid,text,boolean),private.delete_household(uuid,text),private.prepare_account_deletion(),private.record_audit(uuid,text) to authenticated;
revoke all on function public.read_household(uuid),public.save_household(uuid,bigint,jsonb,jsonb,uuid,text),public.reset_household(uuid,jsonb,jsonb),public.set_membership(uuid,uuid,text,boolean),public.delete_household(uuid,text),public.prepare_account_deletion(),public.record_audit(uuid,text) from public,anon;
grant execute on function public.read_household(uuid),public.save_household(uuid,bigint,jsonb,jsonb,uuid,text),public.reset_household(uuid,jsonb,jsonb),public.set_membership(uuid,uuid,text,boolean),public.delete_household(uuid,text),public.prepare_account_deletion(),public.record_audit(uuid,text) to authenticated;
create function private.create_household(h uuid,s jsonb,snapshot jsonb,kind text) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_name text;
begin
 if not private.allowed() then raise exception 'access denied' using errcode='42501'; end if;
 if exists(select 1 from public.households where id=h) then perform private.require_owner(h); return h; end if;
 select display_name into owner_name from public.profiles where id=auth.uid();
 insert into public.households(id,name,cutoff,policy,settings,fixture_kind,seeded) values(h,s->'household'->>'name',((s->>'cutoff')||'T00:00:00Z')::timestamptz,s->'policy',s->'settings',kind,true);
 insert into public.household_memberships(household_id,user_id,display_name,role) values(h,auth.uid(),owner_name,'owner');
 perform private.append_state(h,s);
 perform private.store_valuation(h,0,snapshot);
 insert into public.audit_events(household_id,actor_id,action) values(h,auth.uid(),'household_created');
 return h;
end $$;
create function public.create_household(p_household uuid,p_state jsonb,p_snapshot jsonb,p_kind text) returns uuid language sql security invoker set search_path='' as $$ select private.create_household(p_household,p_state,p_snapshot,p_kind) $$;
revoke all on function private.create_household(uuid,jsonb,jsonb,text),public.create_household(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function private.create_household(uuid,jsonb,jsonb,text),public.create_household(uuid,jsonb,jsonb,text) to authenticated;
