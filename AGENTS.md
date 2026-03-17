# Agents para Loja de Camisas

Agentes especializados para automação e desenvolvimento do sistema de gestão de pedidos.

## 1. Agent: Novo Pedido
**Propósito**: Revisar, validar e otimizar o fluxo de criação de pedidos.

**Responsabilidades**:
- Validar entrada de dados (cliente, items, pacote, pagamento)
- Calcular preços, custos e margens
- Gerenciar alocação de estoque interno
- Vincular pedidos a pacotes de importação
- Registrar rastreamento de shipment

**Scope**: 
- `/src/app/admin/pedidos/novo/` (page e actions)
- `/src/components/admin/new-order-*` (componentes do formulário)
- `/src/lib/db/queries.ts` (funções de persistência)

**Fluxo atual**:
1. Admin acessa `/admin/pedidos/novo`
2. Escolhe mode rápido ou avançado
3. Preenche dados do cliente
4. Define items (modelos, tamanhos, quantidades)
5. Configura pacote (novo/existente/stock interno)
6. Define pagamento (porcentagem/valor)
7. Submete via `createOrderManual()`
8. Redireciona para detalhe do pedido

**Checklist de validação**:
- ✅ Cliente preenchido (nome, endereço)
- ✅ Itens com quantidade > 0
- ✅ Valor total > 0 (se comercial)
- ✅ Pacote vinculado (se comercial)
- ✅ Pagamento válido

---

## 2. Agent: Financeiro do Pedido
**Propósito**: Gerenciar custos, pagamentos e cálculo de margens.

**Responsabilidades**:
- Validar alocação de custos
- Recalcular rateio de pacotes
- Gerenciar pagamentos (depósito/pagto cheio)
- Calcular lucro e margem
- Desabilitar cálculos para "uso pessoal"

**Scope**:
- `/src/components/admin/supplier-cost-form.tsx`
- `/src/app/admin/pedidos/[id]/actions.ts` (financeiro)
- `/src/lib/db/queries.ts` (salvar alocações)

**Regras**:
- Custo do pacote = produto + extras + frete interno
- Custo unitário = custo_pacote / qtd_pacote
- Custo alocado = custo_unitário × qtd_pedido
- Qtd mínima do rateio = max(qtd_pedido_real, qtd_pacote_vinculada)
- Uso pessoal: lucro/margem = 0, sem faturamento

---

## 3. Agent: Rastreamento
**Propósito**: Gerenciar tracking de shipments e pacotes.

**Responsabilidades**:
- Atualizar status de rastreio (via 17track)
- Sincronizar múltiplos pedidos do mesmo pacote
- Registrar histórico de rastreio
- Cron de atualização automática

**Scope**:
- `/src/lib/tracking/`
- `/src/app/api/tracking/`

**Endpoints**:
- `POST /api/tracking/refresh` - Atualizar rastreio manualmente
- `GET /api/tracking/cron` - Cron job de sincronização

---

## 4. Agent: Validação de Dados
**Propósito**: Garantir integridade de dados durante operações críticas.

**Responsabilidades**:
- Validar constraints de banco
- Alertar sobre conflitos de quantidade
- Prevenir alocações inválidas
- Validar transições de status

**Validações críticas**:
```
- Pedido comercial: total > 0 + pacote vinculado
- Pedido pessoal: sem custo, sem faturamento
- Stock order: quantidade ≤ disponível
- Rateio: qty_mínima ≤ qty_total
```

---

## 5. Agent: UI/UX
**Propósito**: Melhorar fluxo visual e usabilidade.

**Melhorias propostas**:
- [ ] Indicador visual de modo (rápido/avançado)
- [ ] Preview de custo/margem em tempo real
- [ ] Validação inline de campos críticos
- [ ] Resumo antes de submeter
- [ ] Toast de confirmação/erro
- [ ] Disabled states para operações inválidas

---

## 6. Agent: Testes
**Propósito**: Garantir qualidade do fluxo de pedidos.

**Cenários a testar**:
- [ ] Novo pedido comercial com modelo novo
- [ ] Novo pedido com múltiplos tamanhos
- [ ] Pedido vinculado a pacote existente
- [ ] Stock order com alocação parcial
- [ ] Rateio com múltiplos pedidos
- [ ] Pagamento deposit vs full
- [ ] Uso pessoal sem custo

---

## Como usar Agents neste projeto

### Para implementar uma feature:
```bash
# 1. Identifique o agent responsável
# 2. Verifique o scope e checklist
# 3. Implemente conforme o fluxo

# Exemplo: Adicionar novo tipo de pagamento
# → Agent: Novo Pedido
# → Ficheiros: new-order-details.tsx, actions.ts
# → Validação: determineAmountPaid()
```

### Para revisar código:
```bash
# 1. Identifique qual agent se aplica
# 2. Consulte "Fluxo atual" e "Checklist"
# 3. Valide regras de negócio
# 4. Teste com cenários do agent
```

---

## Referências rápidas

| Agent | Arquivo Principal | Função Chave |
|-------|-----------------|--------------|
| Novo Pedido | `novo/actions.ts` | `createOrderManual()` |
| Financeiro | `supplier-cost-form.tsx` | Cálculos de custo |
| Rastreamento | `/lib/tracking/17track.ts` | `fetchShipmentStatus()` |
| Validação | `queries.ts` | Database constraints |
| UI/UX | `new-order-details.tsx` | Formulário e estado |

---

**Nota**: Para adicionar novo agent, atualize este arquivo e crie um arquivo `.AGENT.md` específico.
