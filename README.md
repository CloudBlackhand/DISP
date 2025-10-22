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
WAHA_API_URL=https://sua-instancia-waha.com
WAHA_API_KEY=sua_chave_api_waha
```

### 2. Deploy no Railway

1. Conecte seu repositório ao Railway
2. Configure as variáveis de ambiente
3. O deploy será automático

## 📱 Como Usar

1. **Verificar Status**: Clique em "Verificar Status WAHA" para confirmar a conexão
2. **Envio Individual**: Digite o número e mensagem para teste
3. **Upload de Contatos**: Faça upload de um arquivo CSV com números de telefone
4. **Envio em Massa**: Configure a mensagem e delay, depois inicie o envio

## 📄 Formato do CSV

O arquivo CSV deve conter uma coluna com números de telefone no formato internacional:
```
5511999999999
5511888888888
5511777777777
```

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
- `POST /api/send-single` - Envio individual
- `POST /api/send-mass` - Envio em massa
- `POST /api/upload-contacts` - Upload de contatos CSV

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
