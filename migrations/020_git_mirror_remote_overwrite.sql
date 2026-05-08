ALTER TABLE local_git_mirrors
  ADD COLUMN IF NOT EXISTS remote_conflict BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE local_git_mirrors
  ADD COLUMN IF NOT EXISTS force_remote_overwrite BOOLEAN NOT NULL DEFAULT false;
