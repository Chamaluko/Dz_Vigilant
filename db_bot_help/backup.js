const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuración
const DB_PATH = './extras/database/bot.db';
const BACKUP_DIR = './backups';
const MAX_BACKUPS = 5; // Mantener solo los últimos 5 backups

// Asegurarse que existe el directorio de backups
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db`);

    // Copiar la base de datos
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`[BACKUP] Backup creado: ${backupPath}`);

    // Limpiar backups antiguos
    cleanOldBackups();
}

function cleanOldBackups() {
    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('backup-'))
        .map(file => ({
            name: file,
            time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    // Eliminar backups antiguos
    if (backups.length > MAX_BACKUPS) {
        backups.slice(MAX_BACKUPS).forEach(backup => {
            fs.unlinkSync(path.join(BACKUP_DIR, backup.name));
            console.log(`[BACKUP] Eliminado backup antiguo: ${backup.name}`);
        });
    }
}

// Exportar funciones
module.exports = {
    createBackup,
    cleanOldBackups
}; 