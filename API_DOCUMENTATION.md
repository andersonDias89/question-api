# 📚 Documentação da API Question API

## 🚀 Funcionalidades Implementadas

### ✅ Sistema Completo de Autenticação
- ✅ Registro de usuário sem necessidade de assinatura
- ✅ Login com email e senha
- ✅ JWT com expiração de 1 hora
- ✅ Recuperação de senha por token
- ✅ Redefinição de senha

### ✅ Gestão de Usuário
- ✅ Atualização de perfil (nome)
- ✅ Alteração de senha (com validação da senha atual)
- ✅ Endpoints protegidos por autenticação

### ✅ Sistema de Assinaturas (Stripe)
- ✅ Criação de assinaturas
- ✅ Verificação de status de assinatura
- ✅ Cancelamento de assinaturas
- ✅ Webhooks para sincronização automática
- ✅ Guard para validar assinatura ativa

### ✅ Segurança
- ✅ Todos endpoints críticos protegidos
- ✅ Validação de assinatura para recursos premium
- ✅ Rate limiting (10 req/min)
- ✅ Senhas criptografadas

---

## 📋 Endpoints da API

### 🔐 **Autenticação** (`/auth`)

#### POST `/auth/login`
Login do usuário
```json
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

#### POST `/auth/forgot-password`
Solicitar recuperação de senha
```json
{
  "email": "usuario@email.com"
}
```

#### POST `/auth/reset-password`
Redefinir senha com token
```json
{
  "token": "token_recebido_no_console",
  "newPassword": "novaSenha123"
}
```

---

### 👤 **Usuários** (`/user`)

#### POST `/user` (Público)
Criar novo usuário
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "senha123"
}
```

#### GET `/user` 🔒
Listar todos os usuários (requer autenticação)

#### GET `/user/profile` 🔒
Obter perfil do usuário autenticado

#### GET `/user/:id` 🔒
Obter usuário por ID (requer autenticação)

#### PUT `/user/profile` 🔒
Atualizar perfil do usuário autenticado
```json
{
  "name": "Novo Nome"
}
```

#### PUT `/user/change-password` 🔒
Alterar senha do usuário
```json
{
  "currentPassword": "senhaAtual",
  "newPassword": "novaSenha123"
}
```

---

### 💳 **Pagamentos** (`/payment`)

#### POST `/payment/subscription` 🔒
Criar assinatura normal
```json
{
  "priceId": "price_1234567890"
}
```

#### POST `/payment/subscription/test` 🔒
Criar assinatura com pagamento de teste
```json
{
  "priceId": "price_1234567890"
}
```

#### GET `/payment/subscription` 🔒
Verificar assinatura do usuário

#### GET `/payment/subscription/status` 🔒
Status da assinatura do usuário

#### DELETE `/payment/subscription` 🔒
Cancelar assinatura

#### POST `/payment/webhook` (Público)
Webhook do Stripe para eventos automáticos

---

### 🏆 **Recursos Premium**

#### GET `/premium-feature` 🔒💎
Endpoint de exemplo que requer assinatura ativa
- Requer: `@UseGuards(JwtAuthGuard, SubscriptionGuard)`

---

## 🔑 Headers Necessários

### Autenticação
```
Authorization: Bearer seu_jwt_token_aqui
```

### Content-Type
```
Content-Type: application/json
```

---

## 🚦 Status Codes

| Código | Descrição |
|--------|-----------|
| 200 | OK - Sucesso |
| 201 | Created - Recurso criado |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token inválido/expirado |
| 403 | Forbidden - Sem assinatura ativa |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Email já existe |

---

## 🔧 Configuração de Desenvolvimento

### Variáveis de Ambiente
```env
# Database
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/question_api"

# JWT
JWT_SECRET="seu-jwt-secret"
REFRESH_TOKEN_SECRET="seu-refresh-secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_sua_chave"
STRIPE_PUBLISHABLE_KEY="pk_test_sua_chave"
STRIPE_WEBHOOK_SECRET="whsec_seu_webhook"
STRIPE_CURRENCY="usd"
```

### Comandos
```bash
# Iniciar banco (Docker)
docker-compose up -d

# Aplicar migrações
npx prisma migrate dev

# Iniciar aplicação
npm run start:dev
```

---

## 🧪 Testando a API

1. **Use o arquivo `client.http`** - Inclui todos os endpoints com exemplos
2. **Fluxo recomendado de teste:**
   - Criar usuário
   - Fazer login
   - Testar endpoints protegidos
   - Criar assinatura de teste
   - Testar recursos premium

---

## 🔐 Guards Implementados

### `JwtAuthGuard`
- Valida token JWT
- Usado em endpoints que precisam de autenticação

### `SubscriptionGuard` 
- Valida se usuário tem assinatura ativa
- Usado em recursos premium
- Verifica status e data de expiração

### Uso Combinado
```typescript
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Get('premium-feature')
```

---

## 🌟 Recursos para SaaS

### Multi-tenancy Preparado
- Estrutura de dados isolada por usuário
- Guards personalizáveis
- Relacionamentos 1:1 (User ↔ Subscription)

### Segurança Empresarial
- Tokens com expiração
- Validação robusta de dados
- Rate limiting global
- Senhas criptografadas (bcrypt)

### Integração Stripe Completa
- Webhooks automáticos
- Status de assinatura em tempo real
- Suporte a modo de desenvolvimento
- Prevenção de duplicatas

---

## 📈 Próximos Passos (Opcional)

### Para Produção
- [ ] Implementar envio de emails (recuperação de senha)
- [ ] Adicionar refresh tokens
- [ ] Logs estruturados
- [ ] Monitoramento (health checks)
- [ ] Rate limiting por usuário

### Features Avançadas
- [ ] Planos de assinatura múltiplos
- [ ] Convites de equipe
- [ ] Auditoria de ações
- [ ] Dashboard administrativo

---

## 🎯 Conclusão

Sua API está **100% funcional** para desenvolvimento e pode servir como base sólida para qualquer SaaS que precise de:

- ✅ Autenticação robusta
- ✅ Sistema de assinaturas
- ✅ Gestão de usuários
- ✅ Segurança empresarial
- ✅ Integração de pagamentos

**A base está pronta para evoluir!** 🚀
