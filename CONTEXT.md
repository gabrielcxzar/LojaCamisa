# CONTEXT

## Objetivo
Painel administrativo para venda de camisas sob encomenda.
O foco do sistema e controlar pedidos, clientes, enderecos, rastreio, custos de fornecedor, pacotes de importacao, pagamentos e lucro.

## Stack
- Next.js 16 com App Router
- React 19
- TypeScript
- Tailwind CSS
- NextAuth para login admin
- PostgreSQL via `postgres`

## Comandos principais
```bash
npm install
npm run dev
npm run build
npm run lint
npm run db:seed
```

## Ambiente
Variaveis relevantes:
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `TRACKING_PROVIDER`
- `TRACKING_17TRACK_KEY`
- `TRACKING_CRON_SECRET`
- `TRACKING_AUTO_REFRESH_HOURS`
- `TRACKING_AUTO_REFRESH_BATCH`

## Estrutura importante
- `src/app/admin/pedidos/novo/page.tsx`: tela de criacao de pedido
- `src/components/admin/new-order-details.tsx`: formulario principal de novo pedido
- `src/app/admin/pedidos/novo/actions.ts`: server action de criacao
- `src/app/admin/pedidos/[id]/page.tsx`: detalhes do pedido
- `src/app/admin/pedidos/[id]/actions.ts`: acoes de financeiro, rastreio, duplicacao, cancelamento
- `src/components/admin/supplier-cost-form.tsx`: formulario de financeiro do pedido
- `src/lib/db.ts`: schema SQL e adaptador de banco
- `src/lib/db/queries.ts`: consultas e regras principais de persistencia
- `src/app/api/tracking/cron/route.ts`: cron de atualizacao de rastreio
- `scripts/seed.ts`: seed inicial

## Entidades principais
- `users`: administradores
- `customers`: cliente do pedido
- `addresses`: endereco do cliente
- `products`: catalogo opcional
- `orders`: cabecalho do pedido
- `order_items`: itens do pedido, incluindo nome/descricao customizados, tamanho, quantidade e preco
- `suppliers`: fornecedores
- `import_packages`: pacote de importacao com custo total, quantidade total e rastreio
- `order_packages`: vinculo 1 pedido -> 1 pacote
- `supplier_orders`: custo alocado por pedido
- `shipments`: rastreio por pedido
- `payments`: entradas e saidas
- `order_status_history`: historico de status
- `action_logs`: auditoria
- `settings`: configuracoes gerais

## Fluxo de pedido
1. Admin cria pedido em `/admin/pedidos/novo`.
2. Pode usar modo rapido ou completo.
3. No modo rapido, o sistema monta `order_items` sem exigir produto cadastrado.
4. Pedido comercial deve ficar vinculado a um pacote novo ou existente.
5. Ao vincular pedido a pacote, o sistema recalcula rateio de custo e replica rastreio para pedidos do mesmo pacote.
6. O detalhe do pedido mostra venda, pagamentos, custo alocado, lucro, margem, cliente, rastreio e log.

## Regras de negocio atuais
- Pedido comercial exige valor vendido total maior que zero.
- Pedido comercial exige pacote de importacao.
- Uso pessoal nao entra em faturamento/lucro.
- O custo do pacote e rateado por quantidade de camisas.
- `order_items.quantity` e a base real para calculos de quantidade do pedido.
- O valor total vendido pode ser distribuido entre varios itens do pedido via preco unitario medio.

## Ajustes feitos nesta sessao
### 1. Multiplos tamanhos no mesmo modelo
Antes:
- Para vender o mesmo modelo em tamanhos diferentes, era necessario duplicar o modelo manualmente.

Agora:
- Um modelo no cadastro rapido aceita varios tamanhos com quantidades diferentes no mesmo bloco.
- O frontend gera um `order_item` por tamanho com quantidade maior que zero.

Arquivos:
- `src/components/admin/new-order-details.tsx`
- `src/app/admin/pedidos/novo/actions.ts`

### 2. Correcao de quantidade no cadastro rapido
Antes:
- Linhas com quantidade invalida podiam cair em fallback para `1`, distorcendo a soma total do pedido.

Agora:
- Quantidades zeradas/invalidas nao entram no pedido.
- O backend bloqueia criacao sem nenhuma camisa valida.

Arquivos:
- `src/app/admin/pedidos/novo/actions.ts`

### 3. Correcao de rateio no financeiro do pedido
Problema:
- A tela de financeiro podia aceitar `Qtd do pacote` menor que a quantidade real do pedido ou do pacote.
- Isso inflava o custo medio por camisa e o custo alocado do pedido.

Agora:
- O formulario considera como minimo a quantidade real do pedido ou do pacote vinculado.
- O backend tambem impede salvar `package_quantity` menor que a soma real das camisas vinculadas ao pacote.

Arquivos:
- `src/components/admin/supplier-cost-form.tsx`
- `src/app/admin/pedidos/[id]/actions.ts`
- `src/app/admin/pedidos/[id]/page.tsx`

### 4. Uso pessoal na tela de financeiro
Antes:
- Pedido de uso pessoal podia exibir lucro negativo de forma enganosa.

Agora:
- A exibicao de lucro e margem em uso pessoal fica zerada.

Arquivos:
- `src/components/admin/supplier-cost-form.tsx`
- `src/app/admin/pedidos/[id]/page.tsx`

## Pontos de atencao
- O projeto usa Postgres real em `DATABASE_URL`; nao ha SQLite local.
- O schema e inicializado em runtime por `initSchema()`.
- Existem alguns textos com acentuacao quebrada na UI; isso nao foi tratado nesta sessao.
- O build acusa aviso deprecado de `middleware` -> `proxy`, mas nao bloqueia.
- O projeto possui 2 vulnerabilidades reportadas por `npm install`; ainda nao foram tratadas.

## Como retomar em um novo chat
Peça algo como:
- "Leia o CONTEXT.md e continue a partir dele"
- "Use o CONTEXT.md como base antes de alterar o projeto"
- "Leia o CONTEXT.md e revise o fluxo de pedidos"

## Sugestoes de proximos passos
- Testar com pedidos reais contendo varios modelos e varios tamanhos.
- Validar se o rateio de pacotes com mais de um pedido esta correto em todos os cenarios.
- Revisar UX do financeiro para deixar explicito que `Valor pago ao fornecedor` e custo total do pacote, nao custo unitario.
- Corrigir textos com encoding quebrado.
