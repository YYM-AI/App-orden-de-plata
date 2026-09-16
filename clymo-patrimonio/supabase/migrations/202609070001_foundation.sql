-- Milestone 2: reproducible synthetic-only PostgreSQL foundation.
create schema if not exists private;
create extension if not exists "uuid-ossp" with schema extensions;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
create function private.entity_id(h uuid, k text) returns uuid language sql immutable strict set search_path = '' as $$ select extensions.uuid_generate_v5(h, k) $$;
revoke all on function private.entity_id(uuid,text) from public;
grant execute on function private.entity_id(uuid,text) to authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 100),
 allowlisted boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.households (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 synthetic boolean not null default true check(synthetic), revision bigint not null default 0 check(revision>=0),
 cutoff timestamptz not null, policy jsonb not null check(jsonb_typeof(policy)='object'),
 settings jsonb not null check(settings->>'reportingCurrency' in ('CLP','USD') and jsonb_typeof(settings->'obligationsVisible')='boolean'),
 fixture_kind text not null check(fixture_kind in ('canonical','north','empty')), seeded boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.household_memberships (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 display_name text not null, role text not null check(role in ('owner','helper')),
 active boolean not null default true, created_at timestamptz not null default now(),
 unique(household_id,user_id)
);
create index membership_user on public.household_memberships(user_id,active,household_id);
create function private.allowed() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.allowlisted)
$$;
create function private.has_role(h uuid, owners_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.allowed() and exists(select 1 from public.household_memberships m where m.household_id=h and m.user_id=auth.uid() and m.active and (not owners_only or m.role='owner'))
$$;
revoke all on function private.allowed(),private.has_role(uuid,boolean) from public,anon;
grant execute on function private.allowed(),private.has_role(uuid,boolean) to authenticated;
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
revoke all on public.profiles,public.households,public.household_memberships from anon,authenticated;
grant select on public.profiles,public.households,public.household_memberships to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy member_household on public.households for select to authenticated using(private.has_role(id));
create policy member_memberships on public.household_memberships for select to authenticated using(private.has_role(household_id));
create function private.immutable_evidence() returns trigger language plpgsql set search_path='' as $$
 begin raise exception 'immutable evidence' using errcode='42501'; end
$$;
revoke all on function private.immutable_evidence() from public,anon,authenticated;

create table public.financial_parties (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 check((payload->>'role' in ('owner','counterparty')) is true)
);
create index financial_parties_household on public.financial_parties(household_id);
alter table public.financial_parties enable row level security;
revoke all on public.financial_parties from anon,authenticated;
grant select,insert,update,delete on public.financial_parties to authenticated;
create policy members_read on public.financial_parties for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.financial_parties for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.financial_parties for each row execute function private.immutable_evidence();

create table public.institutions (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 check((payload->>'synthetic'='true') is true),
 check((length(payload->>'country')=2) is true)
);
create index institutions_household on public.institutions(household_id);
alter table public.institutions enable row level security;
revoke all on public.institutions from anon,authenticated;
grant select,insert,update,delete on public.institutions to authenticated;
create policy members_read on public.institutions for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.institutions for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.institutions for each row execute function private.immutable_evidence();

create table public.instruments (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 check((payload->>'currency' in ('CLP','USD','EUR','CLF')) is true)
);
create index instruments_household on public.instruments(household_id);
alter table public.instruments enable row level security;
revoke all on public.instruments from anon,authenticated;
grant select,insert,update,delete on public.instruments to authenticated;
create policy members_read on public.instruments for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.instruments for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.instruments for each row execute function private.immutable_evidence();

create table public.logical_accounts (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 institution_id uuid generated always as (private.entity_id(household_id,payload->>'institutionId')) stored,
 foreign key(household_id,institution_id) references public.institutions(household_id,id) deferrable initially deferred,
 check((payload->>'side' in ('asset','liability')) is true),
 check((payload->>'currency' in ('CLP','USD','EUR','CLF')) is true),
 check((payload->>'category' in ('bank','cash','investment','deposit','obligation','property','loan','card','other')) is true),
 check((payload->>'valuationBasis' in ('statement_total','component_sum','manual','obligation')) is true),
 check((payload->>'maskedIdentifier' like 'DEMO-%') is true),
 check((payload->>'institutionId' is not null) is true)
);
create index logical_accounts_household on public.logical_accounts(household_id);
create index logical_accounts_institution_id on public.logical_accounts(household_id,institution_id);
alter table public.logical_accounts enable row level security;
revoke all on public.logical_accounts from anon,authenticated;
grant select,insert,update,delete on public.logical_accounts to authenticated;
create policy members_read on public.logical_accounts for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.logical_accounts for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.logical_accounts for each row execute function private.immutable_evidence();

create table public.account_source_bindings (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 check((payload->>'method' in ('manual','synthetic_statement')) is true),
 check(((payload->>'priority')::integer >=0) is true)
);
create index account_source_bindings_household on public.account_source_bindings(household_id);
create index account_source_bindings_account_id on public.account_source_bindings(household_id,account_id);
alter table public.account_source_bindings enable row level security;
revoke all on public.account_source_bindings from anon,authenticated;
grant select,insert,update,delete on public.account_source_bindings to authenticated;
create policy members_read on public.account_source_bindings for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.account_source_bindings for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.account_source_bindings for each row execute function private.immutable_evidence();

create table public.balance_observations (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 binding_id uuid generated always as (private.entity_id(household_id,payload->>'bindingId')) stored,
 foreign key(household_id,binding_id) references public.account_source_bindings(household_id,id) deferrable initially deferred,
 financial_value numeric(60,8) generated always as ((payload->>'amount')::numeric) stored not null,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'currency' in ('CLP','USD','EUR','CLF')) is true),
 check((payload->>'kind' in ('balance','cash','account_total','credit_limit')) is true),
 check((payload->>'synthetic'='true') is true),
 check((payload->>'accountId' is not null) is true),
 check((payload->>'bindingId' is not null) is true),
 check((payload->>'amount' ~ '^(0|[1-9][0-9]{0,29})(\.[0-9]{1,8})?$') is true),
 check((financial_value >= 0) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index balance_observations_household on public.balance_observations(household_id);
create index balance_observations_effective on public.balance_observations(household_id,effective_at,recorded_at);
create index balance_observations_account_id on public.balance_observations(household_id,account_id);
create index balance_observations_binding_id on public.balance_observations(household_id,binding_id);
alter table public.balance_observations enable row level security;
revoke all on public.balance_observations from anon,authenticated;
grant select,insert,update,delete on public.balance_observations to authenticated;
create policy members_read on public.balance_observations for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.balance_observations for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.balance_observations for each row execute function private.immutable_evidence();

create table public.position_observations (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 binding_id uuid generated always as (private.entity_id(household_id,payload->>'bindingId')) stored,
 foreign key(household_id,binding_id) references public.account_source_bindings(household_id,id) deferrable initially deferred,
 instrument_id uuid generated always as (private.entity_id(household_id,payload->>'instrumentId')) stored,
 foreign key(household_id,instrument_id) references public.instruments(household_id,id) deferrable initially deferred,
 financial_value numeric(60,12) generated always as ((payload->>'quantity')::numeric) stored not null,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'synthetic'='true') is true),
 check((payload->>'accountId' is not null) is true),
 check((payload->>'bindingId' is not null) is true),
 check((payload->>'instrumentId' is not null) is true),
 check((payload->>'quantity' ~ '^(0|[1-9][0-9]{0,29})(\.[0-9]{1,12})?$') is true),
 check((financial_value >= 0) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index position_observations_household on public.position_observations(household_id);
create index position_observations_effective on public.position_observations(household_id,effective_at,recorded_at);
create index position_observations_account_id on public.position_observations(household_id,account_id);
create index position_observations_binding_id on public.position_observations(household_id,binding_id);
create index position_observations_instrument_id on public.position_observations(household_id,instrument_id);
alter table public.position_observations enable row level security;
revoke all on public.position_observations from anon,authenticated;
grant select,insert,update,delete on public.position_observations to authenticated;
create policy members_read on public.position_observations for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.position_observations for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.position_observations for each row execute function private.immutable_evidence();

create table public.price_observations (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 instrument_id uuid generated always as (private.entity_id(household_id,payload->>'instrumentId')) stored,
 foreign key(household_id,instrument_id) references public.instruments(household_id,id) deferrable initially deferred,
 financial_value numeric(60,12) generated always as ((payload->>'amount')::numeric) stored not null,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'currency' in ('CLP','USD','EUR','CLF')) is true),
 check((payload->>'instrumentId' is not null) is true),
 check((payload->>'amount' ~ '^(0|[1-9][0-9]{0,29})(\.[0-9]{1,12})?$') is true),
 check((financial_value > 0) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index price_observations_household on public.price_observations(household_id);
create index price_observations_effective on public.price_observations(household_id,effective_at,recorded_at);
create index price_observations_instrument_id on public.price_observations(household_id,instrument_id);
alter table public.price_observations enable row level security;
revoke all on public.price_observations from anon,authenticated;
grant select,insert,update,delete on public.price_observations to authenticated;
create policy members_read on public.price_observations for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.price_observations for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.price_observations for each row execute function private.immutable_evidence();

create table public.exchange_rates (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 financial_value numeric(60,16) generated always as ((payload->>'rate')::numeric) stored not null,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'base' in ('CLP','USD','EUR','CLF')) is true),
 check((payload->>'quote' in ('CLP','USD','EUR','CLF')) is true),
 check((payload->>'base'<>payload->>'quote') is true),
 check((payload->>'rate' ~ '^(0|[1-9][0-9]{0,29})(\.[0-9]{1,16})?$') is true),
 check((financial_value > 0) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index exchange_rates_household on public.exchange_rates(household_id);
create index exchange_rates_effective on public.exchange_rates(household_id,effective_at,recorded_at);
alter table public.exchange_rates enable row level security;
revoke all on public.exchange_rates from anon,authenticated;
grant select,insert,update,delete on public.exchange_rates to authenticated;
create policy members_read on public.exchange_rates for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.exchange_rates for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.exchange_rates for each row execute function private.immutable_evidence();

create table public.uf_values (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 financial_value numeric(60,16) generated always as ((payload->>'clpValue')::numeric) stored not null,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'unit'='CLF') is true),
 check((payload->>'clpValue' ~ '^(0|[1-9][0-9]{0,29})(\.[0-9]{1,16})?$') is true),
 check((financial_value > 0) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index uf_values_household on public.uf_values(household_id);
create index uf_values_effective on public.uf_values(household_id,effective_at,recorded_at);
alter table public.uf_values enable row level security;
revoke all on public.uf_values from anon,authenticated;
grant select,insert,update,delete on public.uf_values to authenticated;
create policy members_read on public.uf_values for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.uf_values for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.uf_values for each row execute function private.immutable_evidence();

create table public.ownership_decisions (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 party_id uuid generated always as (private.entity_id(household_id,payload->>'partyId')) stored,
 foreign key(household_id,party_id) references public.financial_parties(household_id,id) deferrable initially deferred,
 financial_value numeric(60,16) generated always as ((payload->>'householdPercentage')::numeric) stored not null,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'status' in ('confirmed','unknown','disputed')) is true),
 check((payload->>'accountId' is not null) is true),
 check((payload->>'partyId' is not null) is true),
 check((payload->>'householdPercentage' ~ '^(0|[1-9][0-9]{0,29})(\.[0-9]{1,16})?$') is true),
 check((financial_value >= 0) is true),
 check((financial_value<=100) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index ownership_decisions_household on public.ownership_decisions(household_id);
create index ownership_decisions_effective on public.ownership_decisions(household_id,effective_at,recorded_at);
create index ownership_decisions_account_id on public.ownership_decisions(household_id,account_id);
create index ownership_decisions_party_id on public.ownership_decisions(household_id,party_id);
alter table public.ownership_decisions enable row level security;
revoke all on public.ownership_decisions from anon,authenticated;
grant select,insert,update,delete on public.ownership_decisions to authenticated;
create policy members_read on public.ownership_decisions for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.ownership_decisions for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.ownership_decisions for each row execute function private.immutable_evidence();

create table public.inclusion_decisions (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((jsonb_typeof(payload->'include')='boolean') is true),
 check((payload->>'accountId' is not null) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index inclusion_decisions_household on public.inclusion_decisions(household_id);
create index inclusion_decisions_effective on public.inclusion_decisions(household_id,effective_at,recorded_at);
create index inclusion_decisions_account_id on public.inclusion_decisions(household_id,account_id);
alter table public.inclusion_decisions enable row level security;
revoke all on public.inclusion_decisions from anon,authenticated;
grant select,insert,update,delete on public.inclusion_decisions to authenticated;
create policy members_read on public.inclusion_decisions for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.inclusion_decisions for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.inclusion_decisions for each row execute function private.immutable_evidence();

create table public.manual_assets (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 check((payload->>'accountId' is not null) is true)
);
create index manual_assets_household on public.manual_assets(household_id);
create index manual_assets_account_id on public.manual_assets(household_id,account_id);
alter table public.manual_assets enable row level security;
revoke all on public.manual_assets from anon,authenticated;
grant select,insert,update,delete on public.manual_assets to authenticated;
create policy members_read on public.manual_assets for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.manual_assets for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.manual_assets for each row execute function private.immutable_evidence();

create table public.liabilities (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 check((payload->>'principalOnly'='true') is true),
 check((payload->>'accountId' is not null) is true)
);
create index liabilities_household on public.liabilities(household_id);
create index liabilities_account_id on public.liabilities(household_id,account_id);
alter table public.liabilities enable row level security;
revoke all on public.liabilities from anon,authenticated;
grant select,insert,update,delete on public.liabilities to authenticated;
create policy members_read on public.liabilities for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.liabilities for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.liabilities for each row execute function private.immutable_evidence();

create table public.obligations (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 counterparty_id uuid generated always as (private.entity_id(household_id,payload->>'counterpartyId')) stored,
 foreign key(household_id,counterparty_id) references public.financial_parties(household_id,id) deferrable initially deferred,
 check((payload->>'direction' in ('receivable','payable')) is true),
 check((payload->>'currency' in ('CLP','USD','EUR','CLF')) is true),
 check((payload->>'unverified'='true') is true),
 check((payload->>'shared'='false') is true),
 check((payload->>'accountId' is not null) is true),
 check((payload->>'counterpartyId' is not null) is true)
);
create index obligations_household on public.obligations(household_id);
create index obligations_account_id on public.obligations(household_id,account_id);
create index obligations_counterparty_id on public.obligations(household_id,counterparty_id);
alter table public.obligations enable row level security;
revoke all on public.obligations from anon,authenticated;
grant select,insert,update,delete on public.obligations to authenticated;
create policy members_read on public.obligations for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.obligations for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.obligations for each row execute function private.immutable_evidence();

create table public.obligation_events (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 obligation_id uuid generated always as (private.entity_id(household_id,payload->>'obligationId')) stored,
 foreign key(household_id,obligation_id) references public.obligations(household_id,id) deferrable initially deferred,
 linked_cash_observation_id uuid generated always as (private.entity_id(household_id,payload->>'linkedCashObservationId')) stored,
 foreign key(household_id,linked_cash_observation_id) references public.balance_observations(household_id,id) deferrable initially deferred,
 financial_value numeric(60,8) generated always as ((payload->>'amount')::numeric) stored not null,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'kind' in ('initial','repayment','adjustment','forgiveness','write_off','settlement','dispute')) is true),
 check((payload->>'currency' in ('CLP','USD','EUR','CLF')) is true),
 check((payload->>'obligationId' is not null) is true),
 check((payload->>'amount' ~ '^(0|[1-9][0-9]{0,29})(\.[0-9]{1,8})?$') is true),
 check((financial_value >= 0) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index obligation_events_household on public.obligation_events(household_id);
create index obligation_events_effective on public.obligation_events(household_id,effective_at,recorded_at);
create index obligation_events_obligation_id on public.obligation_events(household_id,obligation_id);
create index obligation_events_linked_cash_observation_id on public.obligation_events(household_id,linked_cash_observation_id);
alter table public.obligation_events enable row level security;
revoke all on public.obligation_events from anon,authenticated;
grant select,insert,update,delete on public.obligation_events to authenticated;
create policy members_read on public.obligation_events for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.obligation_events for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.obligation_events for each row execute function private.immutable_evidence();

create table public.duplicate_candidates (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 binding_id uuid generated always as (private.entity_id(household_id,payload->>'bindingId')) stored,
 foreign key(household_id,binding_id) references public.account_source_bindings(household_id,id) deferrable initially deferred,
 candidate_account_id uuid generated always as (private.entity_id(household_id,payload->>'candidateAccountId')) stored,
 foreign key(household_id,candidate_account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 check((payload->>'bindingId' is not null) is true),
 check((payload->>'candidateAccountId' is not null) is true)
);
create index duplicate_candidates_household on public.duplicate_candidates(household_id);
create index duplicate_candidates_binding_id on public.duplicate_candidates(household_id,binding_id);
create index duplicate_candidates_candidate_account_id on public.duplicate_candidates(household_id,candidate_account_id);
alter table public.duplicate_candidates enable row level security;
revoke all on public.duplicate_candidates from anon,authenticated;
grant select,insert,update,delete on public.duplicate_candidates to authenticated;
create policy members_read on public.duplicate_candidates for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.duplicate_candidates for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.duplicate_candidates for each row execute function private.immutable_evidence();

create table public.review_tasks (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 account_id uuid generated always as (private.entity_id(household_id,payload->>'accountId')) stored,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) deferrable initially deferred,
 candidate_id uuid generated always as (private.entity_id(household_id,payload->>'candidateId')) stored,
 foreign key(household_id,candidate_id) references public.duplicate_candidates(household_id,id) deferrable initially deferred,
 check((payload->>'kind' in ('duplicate','missing_rate','stale','property','ownership','missing_price','inclusion')) is true),
 check((payload->>'accountId' is not null) is true)
);
create index review_tasks_household on public.review_tasks(household_id);
create index review_tasks_account_id on public.review_tasks(household_id,account_id);
create index review_tasks_candidate_id on public.review_tasks(household_id,candidate_id);
alter table public.review_tasks enable row level security;
revoke all on public.review_tasks from anon,authenticated;
grant select,insert,update,delete on public.review_tasks to authenticated;
create policy members_read on public.review_tasks for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.review_tasks for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.review_tasks for each row execute function private.immutable_evidence();

create table public.resolution_decisions (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 domain_key text not null check(domain_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 ordinal bigint generated always as identity,
 created_at timestamptz not null default now(),
 unique(household_id,id),
 unique(household_id,domain_key),
 check(id=private.entity_id(household_id,domain_key)),
 check((payload->>'id'=domain_key) is true),
 check(not (payload ? 'householdId') or payload->>'householdId'=household_id::text),
 review_id uuid generated always as (private.entity_id(household_id,payload->>'reviewId')) stored,
 foreign key(household_id,review_id) references public.review_tasks(household_id,id) deferrable initially deferred,
 effective_at timestamptz not null,
 recorded_at timestamptz not null,
 check((payload->>'action' in ('bind','undo_binding','acknowledge','reopen')) is true),
 check((payload->>'reviewId' is not null) is true),
 check((payload->>'effectiveDate' is not null) is true),
 check((payload->>'recordedAt' is not null) is true)
);
create index resolution_decisions_household on public.resolution_decisions(household_id);
create index resolution_decisions_effective on public.resolution_decisions(household_id,effective_at,recorded_at);
create index resolution_decisions_review_id on public.resolution_decisions(household_id,review_id);
alter table public.resolution_decisions enable row level security;
revoke all on public.resolution_decisions from anon,authenticated;
grant select,insert,update,delete on public.resolution_decisions to authenticated;
create policy members_read on public.resolution_decisions for select to authenticated using(private.has_role(household_id));
create policy owners_append on public.resolution_decisions for insert to authenticated with check(private.has_role(household_id,true));
-- No ordinary UPDATE/DELETE policy: even an owner appends a replacement observation.
create trigger protect_history before update or delete on public.resolution_decisions for each row execute function private.immutable_evidence();

create unique index one_duplicate_candidate_per_binding on public.duplicate_candidates(household_id,binding_id);
create unique index one_obligation_per_account on public.obligations(household_id,account_id);
create unique index one_initial_capital on public.obligation_events(household_id,obligation_id) where payload->>'kind'='initial';
create index review_kind on public.review_tasks(household_id,((payload->>'kind')));
create table public.valuation_runs (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 revision bigint not null, policy_version text not null, reporting_currency text not null check(reporting_currency in ('CLP','USD')),
 created_at timestamptz not null default now(), unique(household_id,id),unique(household_id,revision)
);
create table public.valuation_components (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 run_id uuid not null, account_id uuid not null, original_amount numeric(60,16), reporting_value numeric(60,8),
 included boolean not null, side text not null check(side in ('asset','liability')), payload jsonb not null,
 foreign key(household_id,run_id) references public.valuation_runs(household_id,id) on delete cascade,
 foreign key(household_id,account_id) references public.logical_accounts(household_id,id) on delete cascade,
 unique(run_id,account_id), check(original_amount>=0),check(reporting_value>=0)
);
create table public.net_worth_snapshots (
 id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households(id) on delete cascade,
 run_id uuid not null unique, assets numeric(60,8) not null check(assets>=0), liabilities numeric(60,8) not null check(liabilities>=0),
 net_worth numeric(60,8) not null, liquid_cash numeric(60,8) not null check(liquid_cash>=0), created_at timestamptz not null default now(),
 foreign key(household_id,run_id) references public.valuation_runs(household_id,id) on delete cascade,
 check(net_worth=assets-liabilities)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 actor_id uuid, action text not null check(action in ('session','household_created','helper_authorized','role_changed','helper_revoked','export_json','export_csv','deletion_requested','fixture_reset','inclusion','review','observe','ownership','add_manual','obligation_event','settings')),
 created_at timestamptz not null default now()
);
create table private.deletion_receipts (
 id uuid primary key default gen_random_uuid(), actor_id uuid, kind text not null check(kind in ('household','account')), completed_at timestamptz not null default now()
);
alter table private.deletion_receipts enable row level security;
revoke all on private.deletion_receipts from public,anon,authenticated;
create table public.command_receipts (
 id uuid primary key, household_id uuid not null references public.households(id) on delete cascade, revision bigint not null,
 created_at timestamptz not null default now()
);
alter table public.valuation_runs enable row level security;
revoke all on public.valuation_runs from anon,authenticated;
grant select on public.valuation_runs to authenticated;
create policy member_read on public.valuation_runs for select to authenticated using(private.has_role(household_id));
create index valuation_runs_household on public.valuation_runs(household_id);
create trigger protect_history before update or delete on public.valuation_runs for each row execute function private.immutable_evidence();
alter table public.valuation_components enable row level security;
revoke all on public.valuation_components from anon,authenticated;
grant select on public.valuation_components to authenticated;
create policy member_read on public.valuation_components for select to authenticated using(private.has_role(household_id));
create index valuation_components_household on public.valuation_components(household_id);
create trigger protect_history before update or delete on public.valuation_components for each row execute function private.immutable_evidence();
alter table public.net_worth_snapshots enable row level security;
revoke all on public.net_worth_snapshots from anon,authenticated;
grant select on public.net_worth_snapshots to authenticated;
create policy member_read on public.net_worth_snapshots for select to authenticated using(private.has_role(household_id));
create index net_worth_snapshots_household on public.net_worth_snapshots(household_id);
create trigger protect_history before update or delete on public.net_worth_snapshots for each row execute function private.immutable_evidence();
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon,authenticated;
grant select on public.audit_events to authenticated;
create policy member_read on public.audit_events for select to authenticated using(private.has_role(household_id));
create index audit_events_household on public.audit_events(household_id);
create trigger protect_history before update or delete on public.audit_events for each row execute function private.immutable_evidence();
alter table public.command_receipts enable row level security;
revoke all on public.command_receipts from anon,authenticated;
grant select on public.command_receipts to authenticated;
create policy member_read on public.command_receipts for select to authenticated using(private.has_role(household_id));
create index command_receipts_household on public.command_receipts(household_id);
create trigger protect_history before update or delete on public.command_receipts for each row execute function private.immutable_evidence();

-- Explicitly revoke sequence access except the insertable evidence table identities.
grant usage on all sequences in schema public to authenticated;
