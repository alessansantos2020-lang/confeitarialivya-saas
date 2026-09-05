-- ============================================================================
-- ETAPA 1 DO PLANO MESTRE: Planos e Funcionalidades
-- ============================================================================
-- 100% ADITIVA. Não altera nem apaga nada existente.
--
-- Cria:
--   1. public.plans            — planos comerciais do SaaS
--   2. public.features         — catálogo de módulos que podem ser liberados
--   3. public.plan_features    — o que cada plano libera
--   4. stores.plan_id          — coluna nova (nullable) ligando loja -> plano
--   5. public.announcements    — avisos do dono do sistema para as lojas
--   6. public.audit_logs       — registro de ações importantes
--   7. private.store_has_feature() — verificação centralizada (usada pelo RLS)
--
-- REGRA DO PLANO: trocar o plano da loja NUNCA apaga dados. Só corta o acesso.
-- Por isso plan_id é nullable e nenhuma tabela de negócio ganha CASCADE aqui.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PLANOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  description  text,
  price_cents  integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  billing_period text NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'quarterly', 'yearly')),
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. FUNCIONALIDADES (catálogo)
-- ----------------------------------------------------------------------------
-- id é texto legível (ex.: 'reports') porque é ele que o frontend consulta.
CREATE TABLE IF NOT EXISTS public.features (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  module      text NOT NULL DEFAULT 'admin',
  is_core     boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.features.is_core IS
  'Funcionalidade essencial: sempre liberada, nenhum plano pode desligar.';

-- ----------------------------------------------------------------------------
-- 3. PLANO x FUNCIONALIDADE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_features (
  plan_id    uuid NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  feature_id text NOT NULL REFERENCES public.features (id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_feature ON public.plan_features (feature_id);

-- ----------------------------------------------------------------------------
-- 4. LOJA x PLANO
-- ----------------------------------------------------------------------------
-- ON DELETE SET NULL: apagar um plano nunca apaga a loja.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stores_plan ON public.stores (plan_id);

-- ----------------------------------------------------------------------------
-- 5. AVISOS
-- ----------------------------------------------------------------------------
-- store_id NULL = aviso para todas as lojas.
CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  severity   text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  store_id   uuid REFERENCES public.stores (id) ON DELETE CASCADE,
  is_active  boolean NOT NULL DEFAULT true,
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_store ON public.announcements (store_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements (is_active, starts_at);

-- ----------------------------------------------------------------------------
-- 6. LOGS / AUDITORIA
-- ----------------------------------------------------------------------------
-- Sem UPDATE nem DELETE por policy: log é append-only.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_email text,
  action      text NOT NULL,
  module      text NOT NULL,
  store_id    uuid REFERENCES public.stores (id) ON DELETE SET NULL,
  description text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_store ON public.audit_logs (store_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);

-- ----------------------------------------------------------------------------
-- 7. VERIFICAÇÃO CENTRALIZADA: a loja tem essa funcionalidade?
-- ----------------------------------------------------------------------------
-- Uma única fonte de verdade, usada tanto pelo frontend (via RPC) quanto pelas
-- policies de RLS das próximas etapas. Regras:
--   * funcionalidade is_core          -> sempre TRUE
--   * loja sem plano (plan_id NULL)   -> TRUE (não quebra as lojas atuais)
--   * plano inativo                   -> FALSE
--   * caso normal                     -> existe linha em plan_features?
CREATE OR REPLACE FUNCTION private.store_has_feature(_store_id uuid, _feature_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan_id uuid;
BEGIN
  IF _store_id IS NULL OR _feature_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.features WHERE id = _feature_id AND is_core) THEN
    RETURN true;
  END IF;

  SELECT s.plan_id INTO _plan_id
  FROM public.stores s
  WHERE s.id = _store_id;

  -- Loja sem plano definido continua com acesso total (estado atual do sistema).
  IF _plan_id IS NULL THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = _plan_id AND is_active) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.plan_features
    WHERE plan_id = _plan_id AND feature_id = _feature_id
  );
END;
$$;

-- Versão para o frontend: resolve a loja ativa do usuário logado.
CREATE OR REPLACE FUNCTION public.my_store_features(_store_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id
  FROM public.features f
  WHERE private.is_store_member(auth.uid(), _store_id)
    AND private.store_has_feature(_store_id, f.id);
$$;

-- ----------------------------------------------------------------------------
-- 8. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Planos / funcionalidades: qualquer logado LÊ (o admin precisa saber o que tem
-- no plano dele); só o dono do sistema ESCREVE.
DROP POLICY IF EXISTS "Authenticated can read plans" ON public.plans;
CREATE POLICY "Authenticated can read plans" ON public.plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin manages plans" ON public.plans;
CREATE POLICY "Super admin manages plans" ON public.plans
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read features" ON public.features;
CREATE POLICY "Authenticated can read features" ON public.features
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin manages features" ON public.features;
CREATE POLICY "Super admin manages features" ON public.features
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read plan features" ON public.plan_features;
CREATE POLICY "Authenticated can read plan features" ON public.plan_features
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin manages plan features" ON public.plan_features;
CREATE POLICY "Super admin manages plan features" ON public.plan_features
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- Avisos: a loja lê os avisos dela e os globais; só o dono do sistema escreve.
DROP POLICY IF EXISTS "Members read own announcements" ON public.announcements;
CREATE POLICY "Members read own announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (
      is_active
      AND (store_id IS NULL OR private.is_store_member(auth.uid(), store_id))
    )
  );

DROP POLICY IF EXISTS "Super admin manages announcements" ON public.announcements;
CREATE POLICY "Super admin manages announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- Logs: append-only. Ninguém tem UPDATE nem DELETE (nem o super admin, por
-- policy) — leitura só do dono do sistema; a loja lê os logs dela.
DROP POLICY IF EXISTS "Super admin reads logs" ON public.audit_logs;
CREATE POLICY "Super admin reads logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (store_id IS NOT NULL AND private.is_store_admin(auth.uid(), store_id))
  );

DROP POLICY IF EXISTS "Authenticated can append logs" ON public.audit_logs;
CREATE POLICY "Authenticated can append logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
