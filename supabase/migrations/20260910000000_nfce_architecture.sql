-- Arquitetura fiscal NFC-e. Não emite documentos: prepara dados, eventos e retry.

INSERT INTO public.features (id, name, description, module, is_core, sort_order)
VALUES (
  'nfce',
  'NFC-e',
  'Configuração e emissão futura de Nota Fiscal de Consumidor Eletrônica',
  'fiscal',
  false,
  110
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fiscal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'nfce' CHECK (document_type = 'nfce'),
  cnpj text,
  legal_name text,
  trade_name text,
  state_registration text,
  tax_regime text,
  series text NOT NULL DEFAULT '1',
  environment text NOT NULL DEFAULT 'homologation'
    CHECK (environment IN ('homologation', 'production')),
  provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'nfce' CHECK (document_type = 'nfce'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'authorized', 'rejected', 'canceled', 'error')),
  series text,
  number bigint,
  access_key text,
  total_amount numeric(12,2),
  provider text,
  provider_document_id text,
  rejection_reason text,
  xml_path text,
  pdf_path text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  canceled_at timestamptz,
  UNIQUE (store_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_store_created
  ON public.fiscal_documents (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order
  ON public.fiscal_documents (order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status
  ON public.fiscal_documents (store_id, status);

CREATE TABLE IF NOT EXISTS public.fiscal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  provider_event_id text,
  payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_events_document
  ON public.fiscal_events (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fiscal_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('issue', 'query', 'cancel')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_pending
  ON public.fiscal_outbox (next_attempt_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store admins manage fiscal settings" ON public.fiscal_settings;
CREATE POLICY "Store admins manage fiscal settings"
  ON public.fiscal_settings FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id) AND private.can_use_feature(store_id, 'nfce'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id) AND private.can_use_feature(store_id, 'nfce'));

DROP POLICY IF EXISTS "Store admins read fiscal documents" ON public.fiscal_documents;
CREATE POLICY "Store admins read fiscal documents"
  ON public.fiscal_documents FOR SELECT TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id) AND private.can_use_feature(store_id, 'nfce'));

DROP POLICY IF EXISTS "Store admins read fiscal events" ON public.fiscal_events;
CREATE POLICY "Store admins read fiscal events"
  ON public.fiscal_events FOR SELECT TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id) AND private.can_use_feature(store_id, 'nfce'));

DROP POLICY IF EXISTS "Store admins read fiscal outbox" ON public.fiscal_outbox;
CREATE POLICY "Store admins read fiscal outbox"
  ON public.fiscal_outbox FOR SELECT TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id) AND private.can_use_feature(store_id, 'nfce'));

-- Inserção/alteração de documentos, eventos e outbox ficam reservadas ao
-- serviço server-side futuro; o frontend não pode forjar autorização fiscal.
REVOKE INSERT, UPDATE, DELETE ON public.fiscal_documents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fiscal_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fiscal_outbox FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('fiscal-documents', 'fiscal-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Store admins read fiscal files" ON storage.objects;
CREATE POLICY "Store admins read fiscal files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fiscal-documents'
    AND private.is_store_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
    AND private.can_use_feature((storage.foldername(name))[1]::uuid, 'nfce')
  );

CREATE OR REPLACE FUNCTION public.set_fiscal_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_fiscal_settings_updated_at ON public.fiscal_settings;
CREATE TRIGGER set_fiscal_settings_updated_at
  BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_fiscal_updated_at();

DROP TRIGGER IF EXISTS set_fiscal_documents_updated_at ON public.fiscal_documents;
CREATE TRIGGER set_fiscal_documents_updated_at
  BEFORE UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_fiscal_updated_at();

DROP TRIGGER IF EXISTS set_fiscal_outbox_updated_at ON public.fiscal_outbox;
CREATE TRIGGER set_fiscal_outbox_updated_at
  BEFORE UPDATE ON public.fiscal_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_fiscal_updated_at();
