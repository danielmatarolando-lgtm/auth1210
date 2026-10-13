const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

// Cria tabela se não existir
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      username    TEXT    UNIQUE NOT NULL,
      password    TEXT    NOT NULL,
      hwid        TEXT    DEFAULT NULL,
      active      INTEGER DEFAULT 1,
      created_by  TEXT    DEFAULT NULL,
      created_at  TIMESTAMP DEFAULT NOW(),
      expires_at  TIMESTAMP DEFAULT NULL,
      last_login  TIMESTAMP DEFAULT NULL,
      discord_id  TEXT    DEFAULT NULL
    )
  `);
  console.log('Banco inicializado.');
}

init().catch(console.error);

module.exports = pool;
