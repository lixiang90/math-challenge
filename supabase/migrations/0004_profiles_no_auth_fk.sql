-- 0004: decouple profiles.id from auth.users.
--
-- Rationale: the platform needs "bot"/service accounts (e.g. the
-- `math-challenge` owner used for community repos and bulk-imported
-- lean-eval challenges) that are not backed by a real login. Previously
-- `profiles.id` had a hard FK to `auth.users(id)`, which forced creating a
-- dummy auth user. Dropping the FK lets us create such profiles directly
-- while real users still get a profile with id == auth.users.id via the
-- existing `handle_new_user` trigger.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;
