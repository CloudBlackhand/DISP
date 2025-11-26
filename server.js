const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Middleware de autenticação
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DISPIDI"');
    return res.status(401).json({ error: 'Autenticação necessária' });
  }
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  if (username === 'admin' && password === SYSTEM_PASSWORD) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="DISPIDI"');
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
}

// Aplicar autenticação em todas as rotas da API
app.use('/api', requireAuth);
app.use('/webhook', requireAuth);

app.use(express.static('public'));

// Configuração do multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

// Configuração da API WAHA
const WAHA_API_URL = process.env.WAHA_API_URL || 'http://localhost:3000';
let WAHA_BASE_URL = process.env.WAHA_BASE_URL || process.env.WAHA_API_URL || 'http://localhost:3000';
// Remover barra final se existir para evitar duplo slash
if (WAHA_BASE_URL.endsWith('/')) {
  WAHA_BASE_URL = WAHA_BASE_URL.slice(0, -1);
}
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const WAHA_SESSION_NAME = process.env.WAHA_SESSION_NAME || 'default';
const WAHA_USERNAME = process.env.WAHA_USERNAME || 'admin';
const WAHA_PASSWORD = process.env.WAHA_PASSWORD || 'admin123';

// Configuração de autenticação do sistema
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD || 'admin123';

// Função para gerar headers de autenticação
function getAuthHeaders() {
  // Por padrão, tentar sem autenticação primeiro
  return {
    'Content-Type': 'application/json'
  };
}

// Função para gerar headers com autenticação específica
function getAuthHeadersWithAuth() {
  // Usar X-API-Key header (que sabemos que funciona)
  if (WAHA_API_KEY) {
    return {
      'X-API-Key': WAHA_API_KEY,
      'Content-Type': 'application/json'
    };
  }
  
  // Fallback para Basic auth
  const auth = Buffer.from(`${WAHA_USERNAME}:${WAHA_PASSWORD}`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  };
}

// Função para enviar mensagem via WAHA
async function sendMessage(phone, message, session = WAHA_SESSION_NAME) {
  try {
    const url = `${WAHA_BASE_URL}/api/sendText`;
    console.log(`📤 Enviando mensagem para: ${url}`);
    console.log(`📱 Telefone: ${phone}, Mensagem: ${message.substring(0, 50)}...`);
    
    const response = await axios.post(url, {
      session: session,
      chatId: `${phone}@c.us`,
      text: message
    }, {
      headers: getAuthHeadersWithAuth()
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem:`, error.message);
    console.error(`❌ URL tentada: ${WAHA_BASE_URL}/api/sendText`);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
}

// Função para verificar status da sessão
async function checkSessionStatus(session = WAHA_SESSION_NAME) {
  try {
    // Tentar sem autenticação primeiro
    let response;
    try {
      response = await axios.get(`${WAHA_BASE_URL}/api/sessions/${session}`, {
        headers: getAuthHeaders(),
        timeout: 5000
      });
    } catch (noAuthError) {
      // Se falhar, tentar com autenticação
      response = await axios.get(`${WAHA_BASE_URL}/api/sessions/${session}`, {
        headers: getAuthHeadersWithAuth(),
        timeout: 5000
      });
    }
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
}

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Função para normalizar número de telefone brasileiro
function normalizePhoneNumber(phone) {
  // Remove todos os caracteres não numéricos
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Se começar com 55, mantém
  if (cleanPhone.startsWith('55')) {
    return cleanPhone;
  }
  
  // Se começar com 0, remove o 0 e adiciona 55
  if (cleanPhone.startsWith('0')) {
    return '55' + cleanPhone.substring(1);
  }
  
  // Se tem 11 dígitos (DDD + número), adiciona 55
  if (cleanPhone.length === 11) {
    return '55' + cleanPhone;
  }
  
  // Se tem 10 dígitos (DDD + número sem 9), adiciona 55
  if (cleanPhone.length === 10) {
    return '55' + cleanPhone;
  }
  
  // Retorna como está se não conseguir normalizar
  return cleanPhone;
}

// Rota para envio em massa
app.post('/api/send-mass', async (req, res) => {
  const { contacts, message, delay = 5000 } = req.body;
  
  if (!contacts || !Array.isArray(contacts) || !message) {
    return res.status(400).json({ error: 'Lista de contatos e mensagem são obrigatórios' });
  }

  const results = [];
  let successCount = 0;
  let errorCount = 0;
  let normalizedContacts = [];

  // Normalizar todos os números primeiro
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const phone = contact.phone || contact;
    
    if (!phone) continue;

    const normalizedPhone = normalizePhoneNumber(phone);
    normalizedContacts.push({
      original: phone,
      normalized: normalizedPhone
    });
  }

  // Enviar mensagens
  for (let i = 0; i < normalizedContacts.length; i++) {
    const { original, normalized } = normalizedContacts[i];
    
    const result = await sendMessage(normalized, message);
    results.push({
      original,
      normalized,
      success: result.success,
      error: result.error
    });

    if (result.success) {
      successCount++;
    } else {
      errorCount++;
    }

    // Delay entre mensagens para evitar spam
    if (i < normalizedContacts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  res.json({
    total: normalizedContacts.length,
    success: successCount,
    errors: errorCount,
    results
  });
});

// Rota para upload de arquivo CSV
app.post('/api/upload-contacts', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const fs = require('fs');
  const csv = require('csv-parser');
  const contacts = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      // Assumindo que a primeira coluna é o telefone
      const phone = Object.values(row)[0];
      if (phone && phone.trim()) {
        contacts.push(phone.trim());
      }
    })
    .on('end', () => {
      // Limpar arquivo temporário
      fs.unlinkSync(req.file.path);
      res.json({ contacts });
    })
    .on('error', (error) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: 'Erro ao processar arquivo CSV' });
    });
});

// Rota para verificar status da sessão WAHA
app.get('/api/status', async (req, res) => {
  try {
    const response = await axios.get(`${WAHA_BASE_URL}/api/sessions`, {
      headers: getAuthHeadersWithAuth()
    });
    res.json({ success: true, sessions: response.data });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Rota para verificar status da sessão específica
app.get('/api/session-status', async (req, res) => {
  const result = await checkSessionStatus();
  res.json(result);
});


// Webhook para receber notificações do WAHA
app.post('/webhook/waha', async (req, res) => {
  try {
    const { event, session, payload } = req.body;
    
    console.log(`📨 Webhook WAHA recebido: ${event} - Sessão: ${session}`);
    
    // Processar diferentes tipos de eventos
    switch (event) {
      case 'session.status':
        console.log(`📱 Status da sessão ${session}: ${payload.status}`);
        break;
        
      case 'message.created':
        console.log(`💬 Nova mensagem recebida de ${payload.from}: ${payload.body?.substring(0, 50)}...`);
        break;
        
      case 'message.updated':
        console.log(`📝 Mensagem atualizada: ${payload.id} - Status: ${payload.status}`);
        break;
        
      case 'message.deleted':
        console.log(`🗑️ Mensagem deletada: ${payload.id}`);
        break;
        
      default:
        console.log(`🔔 Evento não tratado: ${event}`);
    }
    
    res.json({ success: true, message: 'Webhook processado' });
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para configurar webhook no WAHA
app.post('/api/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = `${req.protocol}://${req.get('host')}/webhook/waha`;
    const wahaUrl = `${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}`;
    
    console.log(`🔗 Configurando webhook:`);
    console.log(`   Webhook URL: ${webhookUrl}`);
    console.log(`   WAHA URL: ${wahaUrl}`);
    
    const response = await axios.put(wahaUrl, {
      name: WAHA_SESSION_NAME,
      config: {
        webhooks: [
          {
            url: webhookUrl,
            events: ['message']
          }
        ]
      }
    }, {
      headers: getAuthHeadersWithAuth()
    });
    
    res.json({ 
      success: true, 
      webhookUrl,
      data: response.data 
    });
  } catch (error) {
    console.error(`❌ Erro ao configurar webhook:`, error.message);
    console.error(`❌ URL tentada: ${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}`);
    res.json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Rota para obter QR code da sessão
app.get('/api/qr-code', async (req, res) => {
  try {
    // Primeiro verificar o status da sessão
    const statusResult = await checkSessionStatus();
    if (!statusResult.success) {
      return res.json({ 
        success: false, 
        error: `Erro ao verificar status da sessão: ${statusResult.error}` 
      });
    }

    const sessionStatus = statusResult.data.status;
    
    // Se a sessão estiver com status FAILED, tentar reiniciar automaticamente
    if (sessionStatus === 'FAILED') {
      console.log(`🔄 Sessão com status FAILED, tentando reiniciar...`);
      try {
        // Parar a sessão primeiro
        await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/stop`, {}, {
          headers: getAuthHeadersWithAuth()
        });
        
        // Aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Iniciar novamente
        await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/start`, {
          name: WAHA_SESSION_NAME,
          config: {
            webhooks: [
              {
                url: `${req.protocol}://${req.get('host')}/webhook/waha`,
                events: ['message', 'session.status']
              }
            ]
          }
        }, {
          headers: getAuthHeadersWithAuth()
        });
        
        // Aguardar a sessão entrar no estado correto
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (restartError) {
        return res.json({ 
          success: false, 
          error: `Erro ao reiniciar sessão: ${restartError.response?.data?.message || restartError.message}` 
        });
      }
    }
    
    // Verificar se a sessão está no estado correto para gerar QR code
    if (sessionStatus !== 'SCAN_QR_CODE' && sessionStatus !== 'OPENING' && sessionStatus !== 'STARTING' && sessionStatus !== 'FAILED') {
      return res.json({ 
        success: false, 
        error: `Sessão não está pronta para QR code. Status atual: ${sessionStatus}. Tente iniciar a sessão primeiro.` 
      });
    }

    const response = await axios.get(`${WAHA_BASE_URL}/api/${WAHA_SESSION_NAME}/auth/qr`, {
      headers: getAuthHeadersWithAuth()
    });
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Rota para iniciar sessão WAHA
app.post('/api/start-session', async (req, res) => {
  try {
    const response = await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/start`, {
      name: WAHA_SESSION_NAME,
      config: {
        webhooks: [
          {
            url: `${req.protocol}://${req.get('host')}/webhook/waha`,
            events: ['message', 'session.status']
          }
        ]
      }
    }, {
      headers: getAuthHeadersWithAuth()
    });
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Rota para parar sessão WAHA
app.post('/api/stop-session', async (req, res) => {
  try {
    const response = await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/stop`, {}, {
      headers: getAuthHeadersWithAuth()
    });
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Rota para reiniciar sessão WAHA
app.post('/api/restart-session', async (req, res) => {
  try {
    // Primeiro para a sessão
    await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/stop`, {}, {
      headers: getAuthHeadersWithAuth()
    });
    
    // Aguarda um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Depois inicia novamente
    const response = await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/start`, {
      name: WAHA_SESSION_NAME,
      config: {
        webhooks: [
          {
            url: `${req.protocol}://${req.get('host')}/webhook/waha`,
            events: ['message', 'session.status']
          }
        ]
      }
    }, {
      headers: getAuthHeadersWithAuth()
    });
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Integração WAHA: ${WAHA_BASE_URL}`);
  console.log(`🔑 Sessão WAHA: ${WAHA_SESSION_NAME}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/waha`);
});
