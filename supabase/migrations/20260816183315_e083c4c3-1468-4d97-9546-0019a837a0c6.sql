-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

-- Ensure SELECT access to storage.buckets for all roles to let Supabase client find them
GRANT SELECT ON storage.buckets TO authenticated, anon;

-- Policy for Public Read Access on 'public' bucket
-- This allows anyone (anon or authenticated) to read files from this specific bucket
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'public');

-- Policy for Authenticated Uploads
-- This allows logged-in users to upload files to the 'public' bucket
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'public');

-- Policy for Authenticated Updates
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'public');

-- Policy for Authenticated Deletes
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'public');
