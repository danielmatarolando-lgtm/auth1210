require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const bcrypt = require('bcrypt');
const pool   = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = '!';

function genPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < len; i++)
    pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

client.on('ready', () => console.log(`Bot online: ${client.user.tag}`));

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;
  if (!isAdmin(msg.member)) return msg.reply('❌ Sem permissao.');

  const args    = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // !criar <usuario> [dias]
  if (command === 'criar') {
    const username = args[1];
    const dias     = parseInt(args[2]) || null;
    if (!username) return msg.reply('Uso: `!criar <usuario> [dias]`');

    const exists = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rows.length) return msg.reply(`❌ Usuário \`${username}\` já existe.`);

    const rawPwd  = genPassword();
    const hashed  = await bcrypt.hash(rawPwd, 10);
    const expires = dias
      ? new Date(Date.now() + dias * 86400000).toISOString()
      : null;

    await pool.query(
      'INSERT INTO users (username, password, expires_at, created_by, discord_id) VALUES ($1, $2, $3, $4, $5)',
      [username, hashed, expires, msg.author.tag, msg.author.id]
    );

    const expMsg = expires
      ? `\nExpira em: \`${new Date(expires).toLocaleDateString('pt-BR')}\``
      : '\nSem expiração';

    try {
      await msg.author.send(
        `✅ **Usuário criado**\nUsuário: \`${username}\`\nSenha: \`${rawPwd}\`` + expMsg
      );
      msg.reply(`✅ Usuário \`${username}\` criado. Credenciais enviadas por DM.`);
    } catch {
      msg.reply(
        `✅ Usuário criado (DM bloqueada):\n\`\`\`Usuario: ${username}\nSenha: ${rawPwd}\`\`\`` + expMsg
      );
    }
  }

  // !desativar <usuario>
  else if (command === 'desativar') {
    const username = args[1];
    if (!username) return msg.reply('Uso: `!desativar <usuario>`');
    const u = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!u.rows.length) return msg.reply(`❌ Não encontrado.`);
    await pool.query('UPDATE users SET active = 0 WHERE username = $1', [username]);
    msg.reply(`🔴 \`${username}\` desativado.`);
  }

  // !ativar <usuario>
  else if (command === 'ativar') {
    const username = args[1];
    if (!username) return msg.reply('Uso: `!ativar <usuario>`');
    const u = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!u.rows.length) return msg.reply(`❌ Não encontrado.`);
    await pool.query('UPDATE users SET active = 1 WHERE username = $1', [username]);
    msg.reply(`🟢 \`${username}\` ativado.`);
  }

  // !reset-hwid <usuario>
  else if (command === 'reset-hwid') {
    const username = args[1];
    if (!username) return msg.reply('Uso: `!reset-hwid <usuario>`');
    const u = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!u.rows.length) return msg.reply(`❌ Não encontrado.`);
    await pool.query('UPDATE users SET hwid = NULL WHERE username = $1', [username]);
    msg.reply(`🔄 HWID de \`${username}\` resetado.`);
  }

  // !deletar <usuario>
  else if (command === 'deletar') {
    const username = args[1];
    if (!username) return msg.reply('Uso: `!deletar <usuario>`');
    await pool.query('DELETE FROM users WHERE username = $1', [username]);
    msg.reply(`🗑️ \`${username}\` deletado.`);
  }

  // !senha <usuario>
  // Gera nova senha para o usuário
  else if (command === 'senha') {
    const username = args[1];
    if (!username) return msg.reply('Uso: `!senha <usuario>`');
    const u = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!u.rows.length) return msg.reply(`❌ Não encontrado.`);
    const rawPwd = genPassword();
    const hashed = await bcrypt.hash(rawPwd, 10);
    await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hashed, username]);
    try {
      await msg.author.send(`🔑 Nova senha de \`${username}\`: \`${rawPwd}\``);
      msg.reply(`🔑 Nova senha enviada por DM.`);
    } catch {
      msg.reply(`🔑 Nova senha (DM bloqueada): \`${rawPwd}\``);
    }
  }

  // !info <usuario>
  else if (command === 'info') {
    const username = args[1];
    if (!username) return msg.reply('Uso: `!info <usuario>`');
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!result.rows.length) return msg.reply(`❌ Não encontrado.`);
    const u = result.rows[0];
    msg.reply(
      `📋 **${u.username}**\n` +
      `Status: ${u.active ? '🟢 Ativo' : '🔴 Inativo'}\n` +
      `HWID: \`${u.hwid || 'Não vinculado'}\`\n` +
      `Criado por: ${u.created_by || 'N/A'}\n` +
      `Expira: ${u.expires_at ? new Date(u.expires_at).toLocaleDateString('pt-BR') : 'Nunca'}\n` +
      `Último login: ${u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Nunca'}`
    );
  }

  // !listar
  else if (command === 'listar') {
    const result = await pool.query('SELECT username, active, last_login FROM users ORDER BY created_at DESC');
    if (!result.rows.length) return msg.reply('Nenhum usuário.');
    const lines = result.rows.map(u =>
      `${u.active ? '🟢' : '🔴'} \`${u.username}\` — login: ${u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'nunca'}`
    );
    for (let i = 0; i < lines.length; i += 20)
      msg.reply(lines.slice(i, i + 20).join('\n'));
  }

  // !ajuda
  else if (command === 'ajuda') {
    msg.reply(
      `**Comandos:**\n` +
      `\`!criar <user> [dias]\` — cria usuário\n` +
      `\`!desativar <user>\` — bloqueia acesso\n` +
      `\`!ativar <user>\` — libera acesso\n` +
      `\`!senha <user>\` — gera nova senha\n` +
      `\`!reset-hwid <user>\` — reseta HWID\n` +
      `\`!deletar <user>\` — remove usuário\n` +
      `\`!info <user>\` — detalhes do usuário\n` +
      `\`!listar\` — lista todos`
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
