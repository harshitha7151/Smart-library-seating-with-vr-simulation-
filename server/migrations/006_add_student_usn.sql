-- Add USN for new self-registered accounts without rewriting existing users.
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS usn text;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_usn_format_chk'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_usn_format_chk
      CHECK (usn IS NULL OR usn ~ '^1RV[0-9]{2}[A-Z]{2}[0-9]{3}$');
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS users_usn_unique_idx
  ON public.users (usn) WHERE usn IS NOT NULL;

COMMIT;
