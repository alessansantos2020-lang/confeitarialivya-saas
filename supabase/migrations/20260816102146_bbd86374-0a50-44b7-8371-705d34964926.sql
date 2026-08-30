CREATE OR REPLACE FUNCTION public.approve_employee(employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Update profile status to active
  UPDATE public.profiles
  SET status = 'active'
  WHERE id = employee_id;

  -- 2. Ensure the user has the 'employee' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (employee_id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_employee(uuid) TO authenticated;