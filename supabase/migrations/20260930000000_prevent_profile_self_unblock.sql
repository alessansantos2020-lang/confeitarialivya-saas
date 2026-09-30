-- Blocked accounts must not be able to restore their own access through the API.
-- Super admins may still block/unblock users; service-role/database maintenance remains allowed.
CREATE OR REPLACE FUNCTION private.prevent_profile_self_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT private.is_super_admin(auth.uid())
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Somente um super administrador pode alterar o status da conta.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_profile_self_status_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_profile_self_status_change_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_self_status_change_trigger
  BEFORE UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_profile_self_status_change();
