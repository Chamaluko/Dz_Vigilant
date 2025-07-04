const { RoleBot, ChannelBot } = require('../database/models');

class ConfigManager {
    constructor() {
        this.configs = new Map();
    }

    async initialize() {
        // Ya no necesitamos crear carpetas - usamos MongoDB
        console.log('✅ ConfigManager inicializado para MongoDB');
    }

    async isConfigured(guildId) {
        if (!guildId) return false;
        
        try {
            // POR AHORA: Si hay cualquier rol o canal, está configurado
            // (El modelo actual no tiene guildId, así que asumimos configuración global)
            const rolesCount = await RoleBot.countDocuments();
            const channelsCount = await ChannelBot.countDocuments();
            
            // Si hay roles o canales configurados, consideramos el servidor configurado
            const isConfigured = rolesCount > 0 || channelsCount > 0;
            
            console.log(`🔍 Verificando configuración - Roles: ${rolesCount}, Canales: ${channelsCount}, Configurado: ${isConfigured}`);
            
            return isConfigured;
        } catch (error) {
            console.error('Error verificando configuración:', error);
            return false;
        }
    }

    async getConfigSummary(guildId) {
        try {
            const roles = await RoleBot.find();
            const channels = await ChannelBot.find();
            
            return {
                isConfigured: roles.length > 0 || channels.length > 0,
                rolesCount: roles.length,
                channelsCount: channels.length,
                roles: roles.map(r => ({ alias: r.alias, name: r.name, id: r.id })),
                channels: channels.map(c => ({ alias: c.alias, name: c.name, id: c.id }))
            };
        } catch (error) {
            console.error('Error obteniendo resumen de configuración:', error);
            return { isConfigured: false, rolesCount: 0, channelsCount: 0, roles: [], channels: [] };
        }
    }

    async resetConfiguration(guildId) {
        try {
            // Eliminar todos los roles y canales configurados
            await RoleBot.deleteMany();
            await ChannelBot.deleteMany();
            
            console.log('🗑️ Configuración reseteada completamente');
            return true;
        } catch (error) {
            console.error('Error reseteando configuración:', error);
            return false;
        }
    }
}

module.exports = new ConfigManager(); 