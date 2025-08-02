const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS: allow frontend hosted on Vercel
app.use(cors({
  origin: 'https://wellmade-ai.vercel.app',
 
}));

app.use(express.json());



// ✅ OpenAI API proxy endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      model = 'gpt-3.5-turbo',
      max_tokens = 4000,
      temperature = 0.7,
    } = req.body;

    // ✅ Get the latest user message
    const lastUserMessage = messages?.slice().reverse().find(m => m.role === 'user')?.content || '';

    // ✅ Simple keyword-based filter
    const allowedKeywords = ['icd', 'cpt', 'medical', 'diagnosis', 'procedure', 'coding', 'code', 'modifier', 'claims', 'insurance', 'rbs', 'hba1c', 'medication', 'treatment', 'billing'];
    const isMedicalRelated = allowedKeywords.some(keyword =>
      lastUserMessage.toLowerCase().includes(keyword)
    );

    // ❌ If unrelated, block the request
    if (!isMedicalRelated) {
      return res.status(400).json({
        error: 'This assistant only answers medical coding-related questions. Please ask something relevant to medical coding.',
      });
    }

    // ✅ Inject system prompt to define Wellmade AI
    const systemPrompt = {
      role: 'system',
      content: `You are Wellmed AI, a helpful assistant developed by Chakri. You specialize in medical coding and related topics. Do not mention OpenAI, GPT, ChatGPT, or your origins. Always stay in character as Wellmade AI.`,
    };

    const modifiedMessages = [systemPrompt, ...messages];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: modifiedMessages,
        max_tokens,
        temperature,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API Error:', data);
      return res.status(response.status).json({
        error: 'OpenAI API Error',
        details: data.error?.message || 'Unknown error',
      });
    }

    // ✅ Sanitize any unwanted mentions
    if (data.choices?.[0]?.message?.content) {
      data.choices[0].message.content = data.choices[0].message.content.replace(
        /OpenAI|ChatGPT|GPT-4|GPT/gi,
        'Wellmade AI'
      );
    }

    res.json(data);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});







// ✅ Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ✅ No static frontend serving needed

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 CORS allowed from: https://wellmade-ai.vercel.app`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;