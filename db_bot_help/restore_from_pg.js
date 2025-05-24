require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_PATH = path.join(__dirname, '..', 'extras', 'database', 'bot.db');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function restoreLatestBackup() {
  try {
    const res = await pool.query(
      'SELECT data FROM backups ORDER BY created_at DESC LIMIT 1'
    );
    if (res.rows.length === 0) {
      console.log('No hay backups en PostgreSQL para restaurar.');
      return;
    }
    const data = res.rows[0].data;
    // Asegurarse que existe el directorio
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, data);
    console.log('✅ Backup restaurado correctamente en', DB_PATH);
  } catch (error) {
    console.error('❌ Error al restaurar backup:', error);
  } finally {
    await pool.end();
  }
}

restoreLatestBackup(); 