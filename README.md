# DISPIDI - Disparador de Mensagens em Massa

Sistema simples e rápido para envio de mensagens em massa integrado com WAHA, otimizado para deploy no Railway.

## 🚀 Funcionalidades

- ✅ Envio individual de mensagens
- ✅ Envio em massa com upload de CSV
- ✅ Interface web intuitiva
- ✅ Controle de delay entre mensagens
- ✅ Integração completa com WAHA
- ✅ Deploy automático no Railway

## 📋 Pré-requisitos

- Node.js 18+
- Conta no Railway
- Instância WAHA configurada

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Configure as seguintes variáveis no Railway:

```
WAHA_API_KEY=test-api-key-123
WAHA_API_URL=https://wahawa-production-a473.up.railway.app
WAHA_BASE_URL=https://wahawa-production-a473.up.railway.app/
WAHA_SESSION_NAME=Diego
WAHA_USERNAME=admin
WAHA_PASSWORD=admin123
PORT=3000
```

### 2. Deploy no Railway

1. Conecte seu repositório ao Railway
2. Configure as variáveis de ambiente
3. O deploy será automático

## 📱 Como Usar

1. **Configurar Sessão**: 
   - Clique em "Iniciar Sessão" para conectar com o WAHA
   - Clique em "Configurar Webhook" para receber notificações
2. **Verificar Status**: Use os botões para verificar conexão e status da sessão
3. **Adicionar Contatos**: 
   - Digite números manualmente (aceita todos os formatos brasileiros)
   - Ou faça upload de um arquivo CSV
4. **Envio em Massa**: Configure a mensagem e delay, depois inicie o envio

## 🔗 Webhook

O sistema inclui webhook automático que recebe notificações do WAHA:
- Status da sessão
- Mensagens recebidas
- Atualizações de mensagens
- Mensagens deletadas

URL do webhook: `https://seu-app.railway.app/webhook/waha`

## 📄 Formatos de Número Aceitos

O sistema aceita números brasileiros em qualquer formato e os normaliza automaticamente para +55:

### Formatos Aceitos:
- `(11) 99999-9999`
- `11999999999`
- `+55 11 99999-9999`
- `011 99999-9999`
- `11 99999-9999`

### Normalização:
Todos os números são automaticamente convertidos para: `5511999999999`

### CSV:
O arquivo CSV deve conter uma coluna com números de telefone em qualquer formato brasileiro.

## 🔧 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Executar em modo desenvolvimento
npm run dev

# Executar em produção
npm start
```

## 📊 API Endpoints

- `GET /` - Interface web
- `GET /api/status` - Status da conexão WAHA
- `GET /api/session-status` - Status da sessão específica
- `POST /api/start-session` - Iniciar sessão WAHA
- `POST /api/setup-webhook` - Configurar webhook
- `POST /api/send-mass` - Envio em massa (com normalização de números)
- `POST /api/upload-contacts` - Upload de contatos CSV
- `POST /webhook/waha` - Webhook para receber notificações do WAHA

## 🛡️ Segurança

- Validação de entrada em todas as rotas
- Rate limiting através de delay configurável
- Sanitização de dados de upload
- Headers de segurança configurados

## 📈 Performance

- Processamento assíncrono de mensagens
- Controle de delay para evitar spam
- Interface responsiva e otimizada
- Deploy otimizado para Railway
