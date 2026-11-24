-- Retire legacy approval/role controls from the live account schema while
-- preserving the old values as inert historical metadata.
BEGIN;

DO $migration$
DECLARE
  has_role boolean;
  has_eligibility boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ), EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'eligibility'
  ) INTO has_role, has_eligibility;

  IF has_role OR has_eligibility THEN
    CREATE TABLE IF NOT EXISTS public.legacy_user_access_archive (
      user_id uuid PRIMARY KEY,
      prior_role text,
      prior_eligibility text,
      archived_at timestamptz NOT NULL DEFAULT now()
    );

    IF has_role AND has_eligibility THEN
      EXECUTE 'INSERT INTO public.legacy_user_access_archive (user_id, prior_role, prior_eligibility)
               SELECT id, role, eligibility FROM public.users
               ON CONFLICT (user_id) DO NOTHING';
    ELSIF has_role THEN
      EXECUTE 'INSERT INTO public.legacy_user_access_archive (user_id, prior_role)
               SELECT id, role FROM public.users
               ON CONFLICT (user_id) DO NOTHING';
    ELSE
      EXECUTE 'INSERT INTO public.legacy_user_access_archive (user_id, prior_eligibility)
               SELECT id, eligibility FROM public.users
               ON CONFLICT (user_id) DO NOTHING';
    END IF;
  END IF;
END
$migration$;

-- No CASCADE: PostgreSQL will stop safely if another database object depends
-- on either field and needs to be reviewed first.
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
ALTER TABLE public.users DROP COLUMN IF EXISTS eligibility;

COMMIT;
