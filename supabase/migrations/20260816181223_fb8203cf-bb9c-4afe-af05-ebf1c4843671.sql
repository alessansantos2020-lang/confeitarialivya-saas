-- Drop existing policies if they exist to ensure a clean state
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

-- Policy for public read access
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
TO anon, authenticated
USING ( bucket_id = 'public' );

-- Policy for authenticated uploads
CREATE POLICY "Authenticated Insert Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'public' );

-- Policy for authenticated updates
CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'public' );

-- Policy for authenticated deletes
CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'public' );
