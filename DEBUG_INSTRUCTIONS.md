# 🐛 Instruções de Debug - Problema de Autenticação

## 🔍 Problema Identificado
O token JWT não está sendo capturado/enviado corretamente nos headers das requisições.

## 📋 Passos para Resolver

### 1. **Primeiro: Verificar Status das Variáveis**
Execute no `client.http`:
```http
GET {{baseUrl}}/health
# Com o script que mostra as variáveis
```

### 2. **Fazer Login Corretamente**
Execute o endpoint de login:
```http
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "joao@email.com",
  "password": "senha123"
}
```

**⚠️ IMPORTANTE:** Após o login, verifique no console se aparece:
- ✅ Token capturado: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- ✅ User ID capturado: e9f99800-f321-4bad-a9a7-cbe704bec6d6

### 3. **Se o Token Não For Capturado Automaticamente**
Copie o token manualmente do response do login e use no teste manual:

```http
GET {{baseUrl}}/user/profile
Authorization: Bearer SEU_TOKEN_COMPLETO_AQUI
```

### 4. **Verificar Logs do Servidor**
No console do servidor, você deve ver:
```
🛡️ JwtAuthGuard - Verificando autenticação...
🛡️ JwtAuthGuard - Authorization header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
✅ JwtAuthGuard - Token encontrado: eyJhbGciOiJIUzI1NiIsInR5cCI...
```

## 🚨 Problemas Comuns

### Problema 1: Token Vazio
**Sintoma:** `Authorization header: Bearer` (sem token)
**Solução:** Execute o login novamente e verifique se o script executa

### Problema 2: Token Não Capturado
**Sintoma:** Variável `authToken` vazia
**Solução:** 
1. Certifique-se que o response do login tem status 200 ou 201
2. Verifique se há campo `access_token` no response
3. Use teste manual copiando o token

### Problema 3: Token Expirado
**Sintoma:** Error JWT expired
**Solução:** Faça login novamente (tokens expiram em 1 hora)

## 🔧 Debugging Avançado

### No VSCode REST Client:
1. **Verificar Response do Login:**
   - Status deve ser 201
   - Body deve ter `access_token`

2. **Verificar Variáveis Globais:**
   - Execute `GET /health` com script de debug
   - Confirme se `authToken` está definido

3. **Teste Manual:**
   - Copie o token do console
   - Cole no endpoint de teste manual
   - Substitua "SEU_TOKEN_AQUI"

## 📞 Se Ainda Não Funcionar

1. **Reinicie o VSCode** (às vezes as variáveis globais ficam corruptas)
2. **Use token direto** nos headers em vez da variável
3. **Verifique o console do servidor** para logs detalhados

## ✅ Quando Estiver Funcionando

Você verá no console do servidor:
```
✅ JwtAuthGuard - Usuário autenticado com sucesso
🔍 JWT Strategy - Payload recebido: { email: 'joao@email.com', sub: '...' }
```

E no response do endpoint:
```json
{
  "id": "e9f99800-f321-4bad-a9a7-cbe704bec6d6",
  "name": "João Silva",
  "email": "joao@email.com",
  "createdAt": "...",
  "updatedAt": "..."
}
```
