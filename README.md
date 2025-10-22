# DISPIDI - Disparador de Mensagens em Massa

Sistema simples e rápido para envio de mensagens em massa integrado com WAHA, otimizado para deploy no Railway.

## 🚀 Funcionalidades

- ✅ Envio individual de mensagens
- ✅ Envio em massa com upload de CSV
- ✅ Interface web intuitiva
- ✅ Controle de delay entre mensagens
- ✅ Integração completa com WAHA
- ✅ **NOVO**: Gerenciamento completo de sessão WhatsApp
- ✅ **NOVO**: Exibição de QR Code para conectar WhatsApp
- ✅ **NOVO**: Controle de sessão (iniciar, parar, reiniciar)
- ✅ **NOVO**: Auto-refresh para monitoramento em tempo real
- ✅ **NOVO**: Status detalhado da sessão
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
SYSTEM_PASSWORD=admin123
PORT=3000
```

### 2. Deploy no Railway

1. Conecte seu repositório ao Railway
2. Configure as variáveis de ambiente
3. O deploy será automático

## 📱 Como Usar

1. **Acessar o Sistema**: 
   - Usuário: `admin`
   - Senha: valor da variável `SYSTEM_PASSWORD` (padrão: `admin123`)
2. **Gerenciar Sessão WhatsApp**: 
   - Clique em "Iniciar Sessão" para conectar com o WAHA
   - Clique em "Obter QR Code" para exibir o QR code e conectar seu WhatsApp
   - Use "Parar Sessão" ou "Reiniciar Sessão" conforme necessário
   - Ative o "Auto-Refresh" para monitoramento em tempo real
3. **Configurar Webhook**: 
   - Clique em "Configurar Webhook" para receber notificações
4. **Verificar Status**: Use os botões para verificar conexão e status detalhado da sessão
5. **Adicionar Contatos**: 
   - Digite números manualmente (aceita todos os formatos brasileiros)
   - Ou faça upload de um arquivo CSV
6. **Envio em Massa**: Configure a mensagem e delay, depois inicie o envio

## 🔗 Webhook

O sistema inclui webhook automático que recebe notificações do WAHA:
- Status da sessão
- Mensagens recebidas
- Atualizações de mensagens
- Mensagens deletadas

URL do webhook: `https://seu-app.railway.app/webhook/waha`

## 📱 Gerenciamento de Sessão WhatsApp

### Funcionalidades Disponíveis:

1. **Iniciar Sessão**: Cria uma nova sessão WhatsApp no WAHA
2. **Obter QR Code**: Exibe o QR code para conectar seu WhatsApp
3. **Parar Sessão**: Para a sessão atual do WhatsApp
4. **Reiniciar Sessão**: Para e inicia novamente a sessão
5. **Auto-Refresh**: Monitora automaticamente o status da sessão
6. **Status Detalhado**: Mostra informações completas sobre a sessão

### Como Conectar seu WhatsApp:

1. Clique em "Iniciar Sessão"
2. Clique em "Obter QR Code"
3. Escaneie o QR code com seu WhatsApp
4. A sessão será conectada automaticamente
5. Use "Auto-Refresh" para monitoramento contínuo

### Status da Sessão:

- **SCANNING**: Aguardando escaneamento do QR code
- **OPENING**: Conectando ao WhatsApp
- **PAIRING**: Emparelhando dispositivo
- **CONNECTED**: Conectado e pronto para uso
- **FAILED**: Erro na conexão
- **TIMEOUT**: Tempo esgotado

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
- `GET /api/qr-code` - **NOVO**: Obter QR code da sessão
- `POST /api/start-session` - Iniciar sessão WAHA
- `POST /api/stop-session` - **NOVO**: Parar sessão WAHA
- `POST /api/restart-session` - **NOVO**: Reiniciar sessão WAHA
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
