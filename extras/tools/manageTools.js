const fs = require('fs');
const path = require('path');

/**
 * Obtiene información de un canal por su alias
 * @param {string} alias - Alias del canal en la configuración
 * @returns {Object|null} - Información del canal o null si no se encuentra
 */
function getInfoChannel_byAlias(alias) {
    try {
        const configPath = path.join(__dirname, '../../config/defaults.json');
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const channel = configData.channelsBot[alias];
        return channel ? { alias, ...channel } : null;
    } catch (error) {
        console.error(`Error al leer la configuración de canales: ${error.message}`);
        return null;
    }
}

module.exports = {
    getInfoChannel_byAlias
};
