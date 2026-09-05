-- O bucket 'public' nunca existiu no banco. O frontend tentava criá-lo em
-- toda carga de tela (ensurePublicBucket), o que sempre falhava porque
-- storage.buckets só tem policy de SELECT para authenticated, sem INSERT.
-- Criação de bucket é ação de infraestrutura: deve existir via migration,
-- não ser tentada pelo cliente a cada acesso.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('public', 'public', true, 5242880)
ON CONFLICT (id) DO NOTHING;
