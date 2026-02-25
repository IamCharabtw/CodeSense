require('dotenv').config();

const express = require('express');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not set. AI endpoints will return an error until configured.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function askModel(instruction, code, model = process.env.OPENAI_MODEL || 'gpt-4o-mini') {
  const completion = await openai.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You are an expert coding assistant. Respond only with code, no markdown fences or explanation unless explicitly requested.',
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: `${instruction}\n\n${code}` }],
      },
    ],
    temperature: 0.2,
    max_output_tokens: 600,
  });

  return completion.output_text?.trim();
}

function ensureApiKey(req, res, next) {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing OPENAI_API_KEY.' });
  }
  return next();
}

app.post('/api/complete', ensureApiKey, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '"code" must be a non-empty string.' });
    }

    const suggestion = await askModel(
      'Continue the following code from where it currently ends. Keep style and language consistent.',
      code,
    );

    return res.json({ suggestion: suggestion || '' });
  } catch (error) {
    console.error('Completion error:', error);
    return res.status(500).json({ error: 'Failed to generate completion.' });
  }
});

app.post('/api/optimize', ensureApiKey, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '"code" must be a non-empty string.' });
    }

    const optimized = await askModel(
      'Analyze and improve this code. Return the improved version only.',
      code,
    );

    return res.json({ optimizedCode: optimized || code });
  } catch (error) {
    console.error('Optimize error:', error);
    return res.status(500).json({ error: 'Failed to optimize code.' });
  }
});

app.listen(PORT, () => {
  console.log(`CodeSense server listening at http://localhost:${PORT}`);
});
