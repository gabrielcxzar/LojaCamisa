# Loja Camisa

Sistema administrativo simples para venda de camisas sob encomenda.
Foco: controle de pedidos, cliente/destino, rastreio, custos e lucro.

## Stack
- Next.js (App Router) + React
- PostgreSQL (Supabase) via SQL
- NextAuth (login admin)
- Tailwind CSS

## O que o sistema cobre hoje
- Cadastro rapido de pedido (sem precisar cadastrar produto/modelo antes)
- Cliente + destino completo
- Quantidade, preco unitario e forma de pagamento
- Rastreio opcional ja na criacao do pedido
- Controle de custo de fornecedor e margem
- Financeiro com taxas estimadas (percentual e fixa por pagamento)

## Como rodar
1. Instale dependencias:
```bash
npm install
```
2. Configure variaveis de ambiente:
```bash
copy .env.example .env
```
3. Preencha `DATABASE_URL` com sua conexao PostgreSQL do Supabase.
4. Rode seed inicial (cria schema/tabelas, admin e dados base):
```bash
npm run db:seed
```
5. Inicie:
```bash
npm run dev
```

## Deploy (Vercel + Supabase)
1. Criar projeto no Supabase.
2. Copiar `DATABASE_URL` PostgreSQL.
3. Criar projeto na Vercel e conectar este repositório.
4. Configurar variaveis na Vercel:
   - `DATABASE_URL`
   - `NEXTAUTH_URL` (URL final da Vercel)
   - `NEXTAUTH_SECRET`
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `TRACKING_PROVIDER`, `TRACKING_17TRACK_KEY` (se usar rastreio automatico)
   - `CRON_SECRET` (usado pela Vercel para autenticar o cron)
   - `TRACKING_CRON_SECRET`
   - `TRACKING_AUTO_REFRESH_HOURS` (ex: `6`)
   - `TRACKING_AUTO_REFRESH_BATCH` (ex: `20`)
5. Fazer deploy.
6. Executar `npm run db:seed` com o mesmo `DATABASE_URL` de producao (uma vez).

## Atualizacao automatica de rastreio
- O projeto possui cron pronto em `vercel.json` para executar `GET /api/tracking/cron` a cada 6 horas.
- O endpoint e protegido por `TRACKING_CRON_SECRET` (Bearer token).
- A cada execucao, o sistema atualiza rastreios ativos (`AWAITING_SUPPLIER`, `PREPARING`, `SHIPPED`) e marca como `DELIVERED` quando detecta entrega.
- Para testar manualmente em desenvolvimento:
```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/api/tracking/cron" -Headers @{ Authorization = "Bearer SEU_SEGREDO" }
```

## Rotas principais
- `/admin`: dashboard
- `/admin/pedidos`: lista de pedidos
- `/admin/pedidos/novo`: criar venda
- `/admin/financeiro`: faturamento, custo, lucro, taxas
- `/admin/configuracoes`: nome da loja, dias de atraso, taxas

## Variaveis de ambiente
- `DATABASE_URL`: PostgreSQL do Supabase
- `NEXTAUTH_URL`: URL base da aplicacao
- `NEXTAUTH_SECRET`: segredo do NextAuth
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: admin inicial
- `TRACKING_PROVIDER`: `17track`
- `TRACKING_17TRACK_KEY`: chave da API de rastreio
- REDIS_URL: conexao Redis para rate limit distribuido
- `CRON_SECRET`: segredo padrao de autenticação de cron na Vercel
- `TRACKING_CRON_SECRET`: segredo para proteger o endpoint de cron
- `TRACKING_AUTO_REFRESH_HOURS`: intervalo minimo para reconsultar rastreios
- `TRACKING_AUTO_REFRESH_BATCH`: maximo de pedidos por rodada do cron
- `TRACKING_CRON_RATE_WINDOW_MS`: janela de rate limit do endpoint cron (padrao: 60000)
- `TRACKING_CRON_RATE_MAX`: maximo de chamadas por janela no cron (padrao: 5)
- `TRACKING_REFRESH_RATE_WINDOW_MS`: janela de rate limit do endpoint refresh (padrao: 60000)
- `TRACKING_REFRESH_RATE_MAX`: maximo de chamadas por janela no refresh (padrao: 20)

