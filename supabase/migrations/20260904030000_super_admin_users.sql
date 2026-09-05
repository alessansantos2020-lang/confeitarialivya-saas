-- ============================================================================
-- USUÁRIOS NO PAINEL DO DONO DO SAAS
-- ============================================================================
-- Aditiva: nenhuma tabela nova, nenhuma coluna alterada, nenhum dado apagado.
--
-- Duas coisas aqui:
--
--   1. BLOQUEIO DE VERDADE. Até agora `profiles.status = 'blocked'` era só um
--      texto que as telas liam. Quem chamasse a API direto com um token ainda
--      válido continuava lendo e gravando. Bloquear precisa valer no banco.
--
--   2. A LISTA DE USUÁRIOS. E-mail e último acesso vivem em `auth.users`, que
--      a API REST não expõe (e nem deve). Uma função no banco lê de lá e só
--      responde para o dono do sistema. Nada de copiar e-mail para dentro de
--      `profiles` — cópia de dado desatualiza.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. A CONTA ESTÁ ATIVA?
-- ----------------------------------------------------------------------------
-- Só 'blocked' explícito nega. Conta sem linha em `profiles`, ou com status
-- nulo, continua passando: assim esta migração não corta o acesso de ninguém
-- por acidente.
CREATE OR REPLACE FUNCTION private.is_account_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND status = 'blocked'
  );
$$;

REVOKE ALL ON FUNCTION private.is_account_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_account_active(uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION private.is_account_active(uuid) IS
  'FALSE apenas quando profiles.status = ''blocked''. Consultada pelas funções de acesso, então o bloqueio vale para todo o RLS.';

-- ----------------------------------------------------------------------------
-- 2. O BLOQUEIO ENTRA NAS FUNÇÕES QUE TODO O RLS JÁ USA
-- ----------------------------------------------------------------------------
-- Nenhuma policy é tocada. Como produtos, pedidos, adicionais, configurações e
-- planos todos passam por estas três funções, acrescentar a checagem aqui faz o
-- bloqueio pegar de uma vez em tudo. Mesmo princípio do gate de plano: um lugar
-- só decide.
CREATE OR REPLACE FUNCTION private.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  ) AND private.is_account_active(_user_id);
$$;

CREATE OR REPLACE FUNCTION private.is_store_member(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.store_members
      WHERE user_id = _user_id AND store_id = _store_id
    )
    AND private.is_account_active(_user_id)
  ) OR private.is_super_admin(_user_id);
$$;

CREATE OR REPLACE FUNCTION private.is_store_admin(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (
      EXISTS (
        SELECT 1 FROM public.store_members
        WHERE user_id = _user_id AND store_id = _store_id AND role = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM public.stores
        WHERE id = _store_id AND owner_id = _user_id
      )
    )
    AND private.is_account_active(_user_id)
  ) OR private.is_super_admin(_user_id);
$$;

-- ----------------------------------------------------------------------------
-- 3. NÃO DÁ PARA TRANCAR O DONO DO SISTEMA FORA
-- ----------------------------------------------------------------------------
-- Sem isto, bloquear a última conta super_admin ativa deixaria o sistema sem
-- ninguém capaz de desbloquear — e não haveria volta pela interface.
CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'blocked' AND COALESCE(OLD.status, '') <> 'blocked' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.id AND role = 'super_admin'
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'super_admin'
        AND ur.user_id <> NEW.id
        AND COALESCE(p.status, 'active') <> 'blocked'
    ) THEN
      RAISE EXCEPTION 'Esta é a última conta de administrador do sistema ativa e não pode ser bloqueada.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_last_super_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_last_super_admin_trigger ON public.profiles;
CREATE TRIGGER protect_last_super_admin_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_super_admin();

-- ----------------------------------------------------------------------------
-- 4. A LISTA DE USUÁRIOS PARA O PAINEL
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER porque precisa ler auth.users. A primeira linha do corpo é o
-- portão: quem não é dono do sistema recebe erro, não lista vazia.
CREATE OR REPLACE FUNCTION public.super_admin_users()
RETURNS TABLE (
  id              uuid,
  email           text,
  full_name       text,
  status          text,
  role            public.app_role,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  stores          jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador do sistema.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.full_name,
    COALESCE(p.status, 'active'),
    ur.role,
    u.last_sign_in_at,
    u.created_at,
    COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object('id', s.id, 'name', s.name, 'role', sm.role)
               ORDER BY s.name
             )
      FROM public.store_members sm
      JOIN public.stores s ON s.id = sm.store_id
      WHERE sm.user_id = u.id
    ), '[]'::jsonb)
  FROM auth.users u
  LEFT JOIN public.profiles p   ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ORDER BY COALESCE(p.full_name, u.email::text);
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_users() TO authenticated, service_role;

COMMENT ON FUNCTION public.super_admin_users() IS
  'Lista as contas do sistema com e-mail e último acesso (lidos de auth.users). Só o super admin executa.';

