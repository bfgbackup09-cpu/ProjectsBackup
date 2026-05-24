
-- Create private bucket for daily project backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-backups', 'project-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Allow project members/admins to list & download their project's backups.
-- File path convention: {project_id}/{YYYY-MM-DD}.xlsx
-- The first folder segment is the project_id (uuid).
CREATE POLICY "project_backups_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-backups'
  AND public.can_access_project(((storage.foldername(name))[1])::uuid)
);

-- Service role bypasses RLS so the scheduled job can write.
-- (No insert/update/delete policy for authenticated users — backups are read-only.)
