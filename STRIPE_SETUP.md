# Configuração do Stripe

## Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/question_api?schema=public"

# JWT
JWT_SECRET="your-jwt-secret-key"
REFRESH_TOKEN_SECRET="your-refresh-token-secret-key"

# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
STRIPE_CURRENCY="usd"
STRIPE_API_VERSION="2024-12-18.acacia"

# App Configuration
PORT=3000
NODE_ENV=development
```

## Configuração no Stripe Dashboard

1. **Criar uma conta no Stripe** (https://stripe.com)
2. **Obter as chaves de API**:
   - Vá para Developers > API keys
   - Copie a "Publishable key" e "Secret key"
3. **Criar produtos e preços**:
   - Vá para Products
   - Crie um produto (ex: "Plano Premium")
   - Adicione um preço recorrente
   - Copie o Price ID (ex: "price_1234567890")
4. **Configurar Webhook**:
   - Vá para Developers > Webhooks
   - Adicione endpoint: `https://seu-dominio.com/payment/webhook`
   - Selecione os eventos:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copie o "Signing secret"

## Testando a Integração

### 1. Criar uma assinatura
```bash
curl -X POST http://localhost:3000/payment/subscription \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_1234567890"
  }'
```

### 2. Verificar assinatura
```bash
curl -X GET http://localhost:3000/payment/subscription \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Cancelar assinatura
```bash
curl -X DELETE http://localhost:3000/payment/subscription \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Fluxo de Pagamento

1. **Cliente cria assinatura** → Retorna subscription com status `incomplete`
2. **Cliente completa pagamento** → Webhook atualiza status para `active`
3. **Pagamento falha** → Webhook atualiza status para `past_due`
4. **Assinatura cancelada** → Status muda para `canceled`

## Observações Importantes

- Use sempre as chaves de teste (`sk_test_`) durante desenvolvimento
- O webhook deve ser configurado com HTTPS em produção
- Teste os webhooks usando o Stripe CLI
- Mantenha as chaves secretas seguras e nunca as commite no repositório
