ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS whatsapp_template_recebido text;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS whatsapp_template_saida_entrega text;

UPDATE public.store_settings 
SET 
  whatsapp_template_recebido = 'Olá {nome}, seu pedido #{numero_pedido} foi recebido pela {loja}!\n\n🛍️ *Itens:* {itens}\n💰 *Total:* {total}\n💳 *Pagamento:* {pagamento}\n📍 *Endereço:* {endereco}\n\nObrigado pela preferência!',
  whatsapp_template_saida_entrega = 'Olá {nome}, seu pedido #{numero_pedido} da {loja} saiu para entrega! 🛵💨\n\nLogo você receberá seus doces artesanais.'
WHERE whatsapp_template_recebido IS NULL;