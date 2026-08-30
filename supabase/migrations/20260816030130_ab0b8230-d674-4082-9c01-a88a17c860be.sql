-- 1. Permitir que usuários vejam seu próprio perfil (necessário para o carregamento inicial)
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 2. Garantir que o status padrão seja 'pending' para novos perfis
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Grant permissões para authenticated em user_roles (caso falte)
GRANT INSERT ON public.user_roles TO authenticated;
