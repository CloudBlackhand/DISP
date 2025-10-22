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
const WAHA_API_KEY = process.env.WAHA_API_KEY;

// Função para enviar mensagem via WAHA
async function sendMessage(phone, message, session = 'default') {
  try {
    const response = await axios.post(`${WAHA_API_URL}/api/sessions/${session}/send-message`, {
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
    const response = await axios.get(`${WAHA_API_URL}/api/sessions`, {
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Integração WAHA: ${WAHA_API_URL}`);
});
