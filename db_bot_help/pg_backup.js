require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_PATH = path.join(__dirname, '..', 'extras', 'database', 'bot.db');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function saveBackupToPostgres() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            console.log('[PG_BACKUP] No se encontró la base de datos local para backup.');
            return false;
        }
        const data = fs.readFileSync(DB_PATH);
        await pool.query(
            'INSERT INTO backups (data) VALUES ($1)',
            [data]
        );
        console.log('[PG_BACKUP] Backup subido a PostgreSQL correctamente.');
        return true;
    } catch (error) {
        console.error('[PG_BACKUP] Error al subir backup a PostgreSQL:', error);
        return false;
    }
}

module.exports = { saveBackupToPostgres }; 