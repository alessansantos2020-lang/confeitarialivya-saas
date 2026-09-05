-- ============================================================================
-- FASE 11 — CONFIGURAÇÕES DO SAAS
-- ============================================================================
-- Cria public.saas_settings: as configurações da PLATAFORMA (nome do SaaS,
-- logo, contato, cor do painel do dono, modo manutenção).
--
-- NÃO confundir com public.store_settings, que é a configuração de CADA LOJA e
-- continua intacta. Nada aqui altera, apaga ou toca em tabela existente.
--
-- A tabela tem UMA ÚNICA LINHA. A garantia é o par de restrições no fim do
-- CREATE: a coluna `singleton` só aceita o valor true (CHECK) e esse valor é
-- único (UNIQUE), então uma segunda linha é impossível.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saas_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton           boolean NOT NULL DEFAULT true,
  name                text NOT NULL DEFAULT 'Painel do Dono',
  logo_url            text,
  contact_email       text,
  contact_phone       text,
  support_info        text,
  primary_color       text NOT NULL DEFAULT '#1d4ed8',
  maintenance_mode    boolean NOT NULL DEFAULT false,
  maintenance_message text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_settings_singleton_key UNIQUE (singleton),
  CONSTRAINT saas_settings_singleton_true CHECK (singleton)
);

-- A linha nasce junto com a tabela: assim o app nunca precisa tratar o caso
-- "não existe configuração" e um UPDATE simples sempre encontra a linha.
INSERT INTO public.saas_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- ============================================================================
-- updated_at
-- ============================================================================
-- Mesmo problema que announcements tinha (20260905000000): sem trigger a data
-- fica congelada na criação.

CREATE OR REPLACE FUNCTION public.touch_saas_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_saas_settings_updated_at_trigger ON public.saas_settings;
CREATE TRIGGER touch_saas_settings_updated_at_trigger
  BEFORE UPDATE ON public.saas_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_saas_settings_updated_at();

-- ============================================================================
-- RLS — "Somente Super Admin poderá alterar", no banco
-- ============================================================================
-- Mesmo desenho de public.plans (20260903120000:187-195): qualquer conta logada
-- LÊ (os painéis precisam saber se está em manutenção e qual é o nome/logo/cor),
-- só o dono do sistema ESCREVE.
--
-- Sem policy para `anon`: o cardápio do cliente não usa estes dados, então
-- e-mail e telefone de contato não ficam expostos publicamente.

ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read saas settings" ON public.saas_settings;
CREATE POLICY "Authenticated can read saas settings" ON public.saas_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin manages saas settings" ON public.saas_settings;
CREATE POLICY "Super admin manages saas settings" ON public.saas_settings
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));
