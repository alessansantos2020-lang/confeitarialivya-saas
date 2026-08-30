-- Assegura que a tabela categories tem a coluna image_url
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url text;

-- Remove políticas de armazenamento existentes para recriação limpa
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- Políticas de RLS para storage.objects (assumindo que o bucket 'public' será criado via ferramenta)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'public');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'public');
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'public');
CREATE POLICY "Authenticated Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'public');

-- Garante permissões na tabela categories
GRANT ALL ON public.categories TO authenticated;
GRANT SELECT ON public.categories TO anon;
GRANT ALL ON public.categories TO service_role;
