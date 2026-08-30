-- Ensure Admins can definitely see and update profiles
-- 1. Grant usage on private schema to authenticated just to be safe (if has_role is there)
GRANT USAGE ON SCHEMA private TO authenticated;

-- 2. Drop and recreate policies with explicit types and schema
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Add a bypass for users to see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 4. Double check GRANTs
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
