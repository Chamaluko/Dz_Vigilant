const fs = require('fs');
const path = require('path');

// Configuración
const DB_PATH = './extras/database/bot.db';
const BACKUP_DIR = './backups';

function restoreLatestBackup() {
    try {
        // Obtener todos los backups
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('backup-'))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        if (backups.length === 0) {
            console.log('[RESTORE] No se encontraron backups');
            return false;
        }

        // Obtener el backup más reciente
        const latestBackup = backups[0];
        const backupPath = path.join(BACKUP_DIR, latestBackup.name);

        // Restaurar la base de datos
        fs.copyFileSync(backupPath, DB_PATH);
        console.log(`[RESTORE] Base de datos restaurada desde: ${latestBackup.name}`);
        return true;
    } catch (error) {
        console.error('[RESTORE] Error al restaurar:', error);
        return false;
    }
}

// Exportar función
module.exports = {
    restoreLatestBackup
}; 