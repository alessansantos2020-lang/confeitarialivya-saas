-- ============================================================================
-- ETAPA 1 (parte 2): dados iniciais de planos e funcionalidades
-- ============================================================================
-- IMPORTANTE: só entram aqui funcionalidades que EXISTEM DE VERDADE no sistema
-- hoje. Nada de módulo inventado (cupons, nota fiscal, estoque e bairros NÃO
-- existem ainda — entram quando forem construídos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNCIONALIDADES REAIS (uma por tela existente)
-- ----------------------------------------------------------------------------
INSERT INTO public.features (id, name, description, module, is_core, sort_order) VALUES
  ('dashboard',  'Painel Geral',      'Resumo de vendas e pedidos do dia',                 'admin', true,  10),
  ('orders',     'Pedidos',           'Receber, acompanhar e alterar status dos pedidos',  'admin', true,  20),
  ('products',   'Produtos',          'Cadastro de produtos do catálogo',                  'admin', true,  30),
  ('categories', 'Categorias',        'Organização dos produtos em categorias',            'admin', true,  40),
  ('addons',     'Adicionais',        'Grupos de adicionais e opcionais dos produtos',     'admin', false, 50),
  ('customers',  'Clientes',          'Lista de clientes derivada dos pedidos',            'admin', false, 60),
  ('delivery',   'Taxas de Entrega',  'Taxas e áreas de entrega da loja',                  'admin', false, 70),
  ('reports',    'Relatórios',        'Relatórios financeiros e de vendas',                'admin', false, 80),
  ('settings',   'Configurações',     'Dados da loja, cores, horário e loja aberta',       'admin', true,  90),
  ('order_hub',  'Central de Pedidos','Tela dedicada de pedidos em tempo real com alerta', 'staff', false, 100)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PLANOS DE EXEMPLO
-- ----------------------------------------------------------------------------
INSERT INTO public.plans (name, slug, description, price_cents, billing_period, sort_order) VALUES
  ('Básico',       'basico',       'Para começar a vender: catálogo e pedidos.',        4990,  'monthly', 10),
  ('Profissional', 'profissional', 'Loja completa com clientes, entregas e relatórios.', 9990,  'monthly', 20),
  ('Premium',      'premium',      'Tudo liberado, incluindo a Central de Pedidos.',     19990, 'monthly', 30)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- O QUE CADA PLANO LIBERA
-- ----------------------------------------------------------------------------
-- As funcionalidades is_core (dashboard, orders, products, categories, settings)
-- valem para todos os planos de qualquer forma — ficam listadas aqui só para a
-- tela de edição do plano mostrar os checkboxes marcados.

-- Básico: o essencial.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM public.plans p
CROSS JOIN public.features f
WHERE p.slug = 'basico'
  AND f.id IN ('dashboard', 'orders', 'products', 'categories', 'settings')
ON CONFLICT DO NOTHING;

-- Profissional: essencial + adicionais, clientes, entregas e relatórios.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM public.plans p
CROSS JOIN public.features f
WHERE p.slug = 'profissional'
  AND f.id IN ('dashboard', 'orders', 'products', 'categories', 'settings',
               'addons', 'customers', 'delivery', 'reports')
ON CONFLICT DO NOTHING;

-- Premium: tudo que existe.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM public.plans p
CROSS JOIN public.features f
WHERE p.slug = 'premium'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- NENHUMA LOJA RECEBE PLANO AUTOMATICAMENTE
-- ----------------------------------------------------------------------------
-- stores.plan_id fica NULL e private.store_has_feature devolve TRUE para loja
-- sem plano. Ou seja: nada muda para as lojas atuais até o dono do sistema
-- atribuir um plano na tela. Isso evita cortar acesso sem aviso.
