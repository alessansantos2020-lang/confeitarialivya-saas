-- Adiciona a coluna product_name na tabela order_items para garantir que o nome do produto seja persistido
-- mesmo que o produto seja deletado ou alterado futuramente.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name text;

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.order_items.product_name IS 'Nome do produto no momento da compra para persistência histórica.';

-- Atualiza registros existentes com o nome atual do produto (opcional, para dados legados)
UPDATE public.order_items oi
SET product_name = p.name
FROM public.products p
WHERE oi.product_id = p.id AND oi.product_name IS NULL;
