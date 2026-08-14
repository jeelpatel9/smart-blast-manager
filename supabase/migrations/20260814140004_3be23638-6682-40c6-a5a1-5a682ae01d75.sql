DROP POLICY IF EXISTS "public read campaign media" ON storage.objects;
CREATE POLICY "admins read campaign media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-media' AND public.has_role(auth.uid(),'admin'));