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

async function askModel(instruction, code, model = process.env.OPENAI_MODEL || 'gpt-4o-mini', maxTokens = 600) {
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
    max_output_tokens: maxTokens,
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

app.post('/api/inline-suggest', ensureApiKey, async (req, res) => {
  try {
    const { code, cursor } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '"code" must be a non-empty string.' });
    }

    if (typeof cursor !== 'number' || Number.isNaN(cursor) || cursor < 0 || cursor > code.length) {
      return res.status(400).json({ error: '"cursor" must be a valid index.' });
    }

    const prefix = code.slice(0, cursor);
    const suffix = code.slice(cursor);
    const suggestion = await askModel(
      'Provide a short inline completion suggestion for this cursor position. Return only the next best code tokens (1-3 short lines max), without repeating existing code.',
      `PREFIX:\n${prefix}\n\nSUFFIX:\n${suffix}`,
      process.env.OPENAI_MODEL || 'gpt-4o-mini',
      120,
    );

    return res.json({ suggestion: suggestion || '' });
  } catch (error) {
    console.error('Inline suggestion error:', error);
    return res.status(500).json({ error: 'Failed to generate inline suggestion.' });
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
