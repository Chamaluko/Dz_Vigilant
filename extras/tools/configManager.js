const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../../config');
        this.configs = new Map();
    }

    async initialize() {
        try {
            // Crear directorio de config si no existe
            await fs.mkdir(this.configPath, { recursive: true });
        } catch (error) {
            console.error('Error al inicializar ConfigManager:', error);
        }
    }

    getConfigPath(guildId) {
        return path.join(this.configPath, `${guildId}.json`);
    }

    async loadConfig(guildId) {
        try {
            const configPath = this.getConfigPath(guildId);
            const data = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            this.configs.set(guildId, config);
            return config;
        } catch (error) {
            this.configs.set(guildId, null);
            return null;
        }
    }

    async saveConfig(guildId, config) {
        try {
            const configPath = this.getConfigPath(guildId);
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            this.configs.set(guildId, config);
            return true;
        } catch (error) {
            console.error(`Error al guardar configuración para ${guildId}:`, error);
            return false;
        }
    }

    async getConfig(guildId) {
        if (!this.configs.has(guildId)) {
            await this.loadConfig(guildId);
        }
        return this.configs.get(guildId);
    }

    async isConfigured(guildId) {
        if (!guildId) return false;
        const config = await this.getConfig(guildId);
        return Boolean(config && config.isConfigured === true);
    }

    async deleteConfig(guildId) {
        try {
            const configPath = this.getConfigPath(guildId);
            await fs.unlink(configPath);
            this.configs.delete(guildId);
            return true;
        } catch (error) {
            console.error(`Error al eliminar configuración para ${guildId}:`, error);
            return false;
        }
    }
}

module.exports = new ConfigManager(); 