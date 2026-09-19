# Como rodar o app no seu celular (Android)

Este app é um template nativo em React Native com Expo, configurado para a **QUENTINHA EXPRES** (mas facilmente alterável para qualquer loja da plataforma).

## Passo 1 — Instale o app Expo Go no seu celular
Abra a **Google Play Store** no seu celular e instale o app **Expo Go** (gratuito).

## Passo 2 — Instale as dependências no computador
No terminal deste projeto, entre na pasta do app e instale:
```bash
cd apps/customer-app
npm install
```

## Passo 3 — Configure as variáveis
Copie o `.env.example` para `.env`:
```bash
cp .env.example .env
```
O `.env` já vem com as chaves públicas do Supabase de produção e o slug da `quentinha-expres`.

## Passo 4 — Inicie o servidor
```bash
npm start
```
Um **QR Code** vai aparecer no seu terminal.

## Passo 5 — Abra no celular
Abra o app **Expo Go** no celular, toque em **"Scan QR code"** e aponte para o terminal. O app vai carregar direto no seu celular com o cardápio real da QUENTINHA EXPRES, fotos dos pratos, sacola, cálculo de troco e envio do pedido.

---

## Como gerar o app de outra loja (marca própria)
Para publicar o app de outra empresa, basta alterar o `.env`:
- `EXPO_PUBLIC_APP_NAME="Nome da Loja"`
- `EXPO_PUBLIC_STORE_SLUG="slug-da-loja"`
- `EXPO_PUBLIC_PRIMARY_COLOR="#cor"`
- `EXPO_PUBLIC_PACKAGE_NAME="com.nomedaloja.app"`

E rodar o build para a Play Store quando sua conta Google Play Console estiver pronta:
```bash
npx eas-cli build --platform android
```
