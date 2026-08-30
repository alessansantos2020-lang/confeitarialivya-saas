-- RLS policies for storage.objects to allow admin uploads and public reads
-- Assuming bucket 'public' exists or will be created.

-- Public read access
CREATE POLICY "Public Read Access" ON storage.objects 
FOR SELECT TO anon, authenticated 
USING (bucket_id = 'public');

-- Admin upload access
CREATE POLICY "Admin Insert Access" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'public');

-- Admin update access
CREATE POLICY "Admin Update Access" ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'public');

-- Admin delete access
CREATE POLICY "Admin Delete Access" ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'public');
