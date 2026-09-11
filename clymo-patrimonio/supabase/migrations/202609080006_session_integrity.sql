-- Membership and allowlist revocation are evaluated against current rows, not stale JWT role claims.
-- Supabase removes auth.sessions on sign-out; deny a retained access JWT on its next DB request.
create or replace function private.allowed() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.allowlisted)
 and exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid())
$$;
