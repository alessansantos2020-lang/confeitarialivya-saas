-- ============================================================================
-- O PLANO DA LOJA SÓ O DONO DO SISTEMA MUDA
-- ============================================================================
-- Aditiva: nenhuma tabela nova, nenhuma coluna alterada, nenhuma policy
-- reescrita, nenhum dado apagado.
--
-- O PROBLEMA
--
-- A policy "Store admins can update own store"
-- (20260902160001_multi_store_schema_and_rls.sql:246) deixa o dono da loja
-- atualizar QUALQUER coluna da própria loja. Não tem WITH CHECK nem restrição
-- de coluna. Verificado contra o banco: com o token de um dono de loja,
--
--   PATCH /rest/v1/stores?id=eq.<propria-loja>  {"plan_id": null}
--
-- altera a linha. E `plan_id IS NULL` faz private.store_has_feature devolver
-- TRUE para tudo (20260903120000_plans_and_features.sql:148-150). Ou seja: uma
-- loja no plano Básico liberava todas as funções pagas com um comando. E uma
-- loja suspensa se reativava sozinha pelo campo `status`.
--
-- O gate de plano no RLS existia, mas quem era barrado controlava a entrada.
--
-- A CORREÇÃO
--
-- Trigger BEFORE UPDATE que recusa a mudança de plan_id, status e owner_id
-- quando quem pede não é o dono do sistema. Renomear a loja continua liberado —
-- é o único campo que o painel da loja mexe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_store_plan_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION
      'Somente o administrador do sistema pode alterar plano, status ou dono da loja.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_store_plan_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_store_plan_fields_trigger ON public.stores;
CREATE TRIGGER protect_store_plan_fields_trigger
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.protect_store_plan_fields();

COMMENT ON FUNCTION public.protect_store_plan_fields() IS
  'Impede que o dono da loja altere plan_id, status ou owner_id da própria loja. Sem isto, o gate de plano do RLS seria contornável pela API.';
