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

// Função para gerar headers de autenticação
function getAuthHeaders() {
  // Por padrão, tentar sem autenticação primeiro
  return {
    'Content-Type': 'application/json'
  };
}

// Função para gerar headers com autenticação específica
function getAuthHeadersWithAuth() {
  // Tentar Bearer token primeiro
  if (WAHA_API_KEY) {
    return {
      'Authorization': `Bearer ${WAHA_API_KEY}`,
      'Content-Type': 'application/json'
    };
  }
  
  // Tentar X-API-Key header
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
    const response = await axios.post(`${WAHA_BASE_URL}/api/sessions/${session}/send-message`, {
      to: phone,
      body: message
    }, {
      headers: getAuthHeaders()
    });
    return { success: true, data: response.data };
  } catch (error) {
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
  const { contacts, message, delay = 1000 } = req.body;
  
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
      headers: getAuthHeaders()
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

// Rota para testar autenticação
app.get('/api/test-auth', async (req, res) => {
  try {
    console.log('🔑 Testando autenticação...');
    console.log('WAHA_API_KEY:', WAHA_API_KEY ? 'Definido' : 'Não definido');
    console.log('WAHA_USERNAME:', WAHA_USERNAME);
    console.log('WAHA_BASE_URL:', WAHA_BASE_URL);
    
    const results = {
      url: WAHA_BASE_URL,
      bearerToken: WAHA_API_KEY ? 'Configurado' : 'Não configurado',
      basicAuth: `${WAHA_USERNAME}:${WAHA_PASSWORD}`,
      tests: []
    };
    
    // Testar sem autenticação primeiro
    try {
      const response = await axios.get(`${WAHA_BASE_URL}/api/sessions`, {
        timeout: 5000
      });
      results.tests.push({
        type: 'Sem autenticação',
        status: 'Sucesso',
        data: response.data
      });
      res.json({ 
        success: true, 
        authType: 'Sem autenticação necessária',
        data: response.data,
        results
      });
      return;
    } catch (noAuthError) {
      results.tests.push({
        type: 'Sem autenticação',
        status: `Falhou: ${noAuthError.response?.status || noAuthError.message}`
      });
    }
    
    // Testar com Bearer token
    if (WAHA_API_KEY) {
      try {
        const response = await axios.get(`${WAHA_BASE_URL}/api/sessions`, {
          headers: {
            'Authorization': `Bearer ${WAHA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        results.tests.push({
          type: 'Bearer Token',
          status: 'Sucesso',
          data: response.data
        });
        res.json({ 
          success: true, 
          authType: 'Bearer Token',
          data: response.data,
          results
        });
        return;
      } catch (bearerError) {
        results.tests.push({
          type: 'Bearer Token',
          status: `Falhou: ${bearerError.response?.status} - ${bearerError.response?.data?.message || bearerError.message}`
        });
        console.log('❌ Bearer token falhou:', bearerError.response?.status, bearerError.response?.data);
      }
    }
    
    // Testar com Basic auth
    try {
      const auth = Buffer.from(`${WAHA_USERNAME}:${WAHA_PASSWORD}`).toString('base64');
      const response = await axios.get(`${WAHA_BASE_URL}/api/sessions`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      results.tests.push({
        type: 'Basic Auth',
        status: 'Sucesso',
        data: response.data
      });
      res.json({ 
        success: true, 
        authType: 'Basic Auth',
        data: response.data,
        results
      });
    } catch (basicError) {
      results.tests.push({
        type: 'Basic Auth',
        status: `Falhou: ${basicError.response?.status} - ${basicError.response?.data?.message || basicError.message}`
      });
      console.log('❌ Basic auth falhou:', basicError.response?.status, basicError.response?.data);
    }
    
    // Testar com X-API-Key header
    if (WAHA_API_KEY) {
      try {
        const response = await axios.get(`${WAHA_BASE_URL}/api/sessions`, {
          headers: {
            'X-API-Key': WAHA_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        results.tests.push({
          type: 'X-API-Key Header',
          status: 'Sucesso',
          data: response.data
        });
        res.json({ 
          success: true, 
          authType: 'X-API-Key Header',
          data: response.data,
          results
        });
        return;
      } catch (apiKeyError) {
        results.tests.push({
          type: 'X-API-Key Header',
          status: `Falhou: ${apiKeyError.response?.status} - ${apiKeyError.response?.data?.message || apiKeyError.message}`
        });
      }
    }
    
    res.json({ 
      success: false, 
      error: 'Todos os tipos de autenticação falharam',
      results
    });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
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
    
    const response = await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/webhook`, {
      url: webhookUrl,
      events: ['session.status', 'message.created', 'message.updated', 'message.deleted']
    }, {
      headers: getAuthHeaders()
    });
    
    res.json({ 
      success: true, 
      webhookUrl,
      data: response.data 
    });
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
            events: ['session.status', 'message.created', 'message.updated', 'message.deleted']
          }
        ]
      }
    }, {
      headers: getAuthHeaders()
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
