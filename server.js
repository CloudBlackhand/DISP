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
const WAHA_BASE_URL = process.env.WAHA_BASE_URL || process.env.WAHA_API_URL || 'http://localhost:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const WAHA_SESSION_NAME = process.env.WAHA_SESSION_NAME || 'default';

// Função para enviar mensagem via WAHA
async function sendMessage(phone, message, session = WAHA_SESSION_NAME) {
  try {
    const response = await axios.post(`${WAHA_BASE_URL}/api/sessions/${session}/send-message`, {
      to: phone,
      body: message
    }, {
      headers: {
        'Authorization': `Bearer ${WAHA_API_KEY}`,
        'Content-Type': 'application/json'
      }
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
    const response = await axios.get(`${WAHA_BASE_URL}/api/sessions/${session}`, {
      headers: {
        'Authorization': `Bearer ${WAHA_API_KEY}`
      }
    });
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

// Rota para enviar mensagem única
app.post('/api/send-single', async (req, res) => {
  const { phone, message } = req.body;
  
  if (!phone || !message) {
    return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios' });
  }

  const result = await sendMessage(phone, message);
  res.json(result);
});

// Rota para envio em massa
app.post('/api/send-mass', async (req, res) => {
  const { contacts, message, delay = 1000 } = req.body;
  
  if (!contacts || !Array.isArray(contacts) || !message) {
    return res.status(400).json({ error: 'Lista de contatos e mensagem são obrigatórios' });
  }

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const phone = contact.phone || contact;
    
    if (!phone) continue;

    const result = await sendMessage(phone, message);
    results.push({
      phone,
      success: result.success,
      error: result.error
    });

    if (result.success) {
      successCount++;
    } else {
      errorCount++;
    }

    // Delay entre mensagens para evitar spam
    if (i < contacts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  res.json({
    total: contacts.length,
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
      headers: {
        'Authorization': `Bearer ${WAHA_API_KEY}`
      }
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
    
    const response = await axios.post(`${WAHA_BASE_URL}/api/sessions/${WAHA_SESSION_NAME}/webhook`, {
      url: webhookUrl,
      events: ['session.status', 'message.created', 'message.updated', 'message.deleted']
    }, {
      headers: {
        'Authorization': `Bearer ${WAHA_API_KEY}`,
        'Content-Type': 'application/json'
      }
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
      headers: {
        'Authorization': `Bearer ${WAHA_API_KEY}`,
        'Content-Type': 'application/json'
      }
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
