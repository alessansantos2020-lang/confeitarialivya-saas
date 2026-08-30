-- Allow authenticated users to see buckets
-- By default, storage.buckets is protected.
-- PostgREST (Supabase Data API) exposes storage.buckets but policies are needed.

DROP POLICY IF EXISTS "Authenticated bucket access" ON storage.buckets;
CREATE POLICY "Authenticated bucket access"
ON storage.buckets FOR SELECT
TO authenticated
USING ( true );

-- Ensure storage schema grants are present
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.objects TO service_role;
