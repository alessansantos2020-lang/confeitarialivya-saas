-- ============================================================================
-- AVISOS: MANTER updated_at EM DIA
-- ============================================================================
-- A tabela public.announcements foi criada em 20260903120000 com a coluna
-- `updated_at timestamptz NOT NULL DEFAULT now()`, mas nada atualizava o valor
-- num UPDATE: editar um aviso deixava a data congelada na criação.
--
-- Só isso. Nenhuma coluna nova, nenhuma policy tocada, nada apagado. O pior
-- efeito possível de um erro aqui é uma data desatualizada — nunca acesso.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_announcements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_announcements_updated_at_trigger ON public.announcements;
CREATE TRIGGER touch_announcements_updated_at_trigger
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_announcements_updated_at();
