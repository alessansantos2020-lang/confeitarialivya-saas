-- Fase 1 multi-loja (parte 1/2): novo papel super_admin.
-- Separado da migration principal porque o Postgres não permite usar
-- um valor de enum recém-criado na mesma transação em que foi adicionado.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
