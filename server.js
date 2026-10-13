require('dotenv').config();
const express = require('express');
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const fetch   = require('node-fetch');
const pool    = require('./db');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.SECRET_KEY || 'changeme';

// URL do webhook Discord para notificações (configure no .env)
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

app.use(express.json());

// ─────────────────────────────────────────────────────────────────
// Envia mensagem para o webhook do Discord
// ─────────────────────────────────────────────────────────────────
async function sendWebhook(content) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (e) {
    console.error('Webhook error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// Gera token simples: HMAC-SHA256(username:hwid:timestamp, SECRET)
// ─────────────────────────────────────────────────────────────────
function makeToken(username, hwid) {
  const payload = `${username}:${hwid}:${Date.now()}`;
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

// ─────────────────────────────────────────────────────────────────
// POST /auth/login
// Body: { username, password, hwid }
// ─────────────────────────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { username, password, hwid } = req.body;

  if (!username || !password || !hwid) {
    return res.status(400).json({ success: false, message: 'Campos ausentes' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario ou senha invalidos' });
    }

    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Conta desativada' });
    }

    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return res.status(403).json({ success: false, message: 'Licenca expirada' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Usuario ou senha invalidos' });
    }

    if (!user.hwid) {
      // Primeira vez: vincula o HWID
      await pool.query(
        'UPDATE users SET hwid = $1, last_login = NOW() WHERE username = $2',
        [hwid, username]
      );
      await sendWebhook(`🔗 HWID vinculado: \`${username}\` → \`${hwid}\``);
    } else if (user.hwid !== hwid) {
      await sendWebhook(`❌ Tentativa HWID invalido: \`${username}\` | HWID: \`${hwid}\``);
      return res.status(403).json({ success: false, message: 'HWID invalido' });
    } else {
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE username = $1',
        [username]
      );
    }

    await sendWebhook(`✅ Login: \`${username}\` | HWID: \`${hwid}\``);

    const token = makeToken(username, hwid);
    return res.json({ success: true, token, message: 'Login realizado' });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/reset-hwid  (chamado internamente pelo bot)
// Body: { username, admin_key }
// ─────────────────────────────────────────────────────────────────
app.post('/auth/reset-hwid', async (req, res) => {
  const { username, admin_key } = req.body;
  if (admin_key !== SECRET) return res.status(403).json({ success: false });

  await pool.query('UPDATE users SET hwid = NULL WHERE username = $1', [username]);
  return res.json({ success: true, message: `HWID resetado para ${username}` });
});

app.listen(PORT, () => {
  console.log(`Auth server rodando na porta ${PORT}`);
});
