-- 1. Create trigger function for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'pending')
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      status = COALESCE(profiles.status, 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Ensure RLS policies for profiles are correct
-- Using private.has_role instead of public.has_role (as identified in previous error)
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

-- 4. Sync missing profiles from auth.users
INSERT INTO public.profiles (id, full_name, status)
SELECT id, raw_user_meta_data->>'full_name', 'pending'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
