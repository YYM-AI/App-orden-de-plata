create function public.export_household(p_household uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; rows jsonb; history jsonb;
begin
 if not private.has_role(p_household,true) then raise exception 'access denied' using errcode='42501'; end if;
 result=jsonb_build_object('state',public.read_household(p_household));
 select coalesce(jsonb_agg(to_jsonb(r) order by r.revision),'[]') into rows from public.valuation_runs r where household_id=p_household;
 history=jsonb_build_object('valuation_runs',rows);
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('original_amount',c.original_amount::text,'reporting_value',c.reporting_value::text) order by c.id),'[]') into rows from public.valuation_components c where household_id=p_household;
 history=history||jsonb_build_object('valuation_components',rows);
 select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('assets',s.assets::text,'liabilities',s.liabilities::text,'net_worth',s.net_worth::text,'liquid_cash',s.liquid_cash::text) order by s.created_at,s.id),'[]') into rows from public.net_worth_snapshots s where household_id=p_household;
 history=history||jsonb_build_object('net_worth_snapshots',rows);
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at,a.id),'[]') into rows from public.audit_events a where household_id=p_household;
 return result||jsonb_build_object('history',history||jsonb_build_object('audit_events',rows));
end $$;
revoke all on function public.export_household(uuid) from public,anon;
grant execute on function public.export_household(uuid) to authenticated;
