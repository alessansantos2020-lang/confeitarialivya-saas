-- Cria o usuário administrador inicial no Supabase NOVO.
-- Rode isto UMA vez, depois de aplicar as migrations no banco novo.
--
-- Login criado por este script:
--   E-mail:  admin@confeitaria.com
--   Senha:   admin123
--
-- Troque o e-mail/senha abaixo antes de rodar, se quiser.

DO $$
DECLARE
  v_email    text := 'admin@confeitaria.com';
  v_password text := 'admin123';
  v_user_id  uuid;
BEGIN
  -- Se o usuário já existe, reaproveita; senão, cria em auth.users.
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Administrador"}',
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      format('{"sub":"%s","email":"%s"}', v_user_id, v_email)::jsonb,
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  -- Perfil ativo
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (v_user_id, 'Administrador', 'active')
  ON CONFLICT (id) DO UPDATE SET full_name = 'Administrador', status = 'active';

  -- Papel admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
