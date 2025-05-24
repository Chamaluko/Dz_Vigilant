const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/indexDB');
const defaults = require('../../config/defaults.json');

class StaticMessageManager {
    static async checkAndSendMessages(client) {
        try {
            // Obtener todos los mensajes estáticos configurados
            const staticMessages = defaults.staticMessages;
            
            for (const [alias, messageConfig] of Object.entries(staticMessages)) {
                // Verificar si el mensaje ya existe en la base de datos
                const existingMessage = await db.get('SELECT * FROM staticMessages WHERE alias = ?', [alias]);
                
                if (existingMessage) {
                    // Verificar si el mensaje aún existe en el canal
                    const channel = await client.channels.fetch(existingMessage.channel_id);
                    if (channel) {
                        try {
                            const message = await channel.messages.fetch(existingMessage.id);
                            if (message) continue; // El mensaje existe, continuar con el siguiente
                        } catch (error) {
                            // El mensaje no existe, lo eliminamos de la base de datos
                            await db.run('DELETE FROM staticMessages WHERE id = ?', [existingMessage.id]);
                        }
                    }
                }

                // Obtener el canal correspondiente según el tipo de mensaje
                let channelConfig;
                if (alias === 'verify') {
                    channelConfig = await db.get('SELECT * FROM channelsBot WHERE alias = ?', ['verification']);
                }
                // Aquí se pueden agregar más condiciones para otros tipos de mensajes

                if (!channelConfig) {
                    console.log(`❌ No se encontró el canal para el mensaje ${alias}`);
                    continue;
                }

                const channel = await client.channels.fetch(channelConfig.id);
                if (!channel) {
                    console.log(`❌ No se pudo acceder al canal ${channelConfig.name}`);
                    continue;
                }

                // Crear el embed
                const embed = new EmbedBuilder()
                    .setTitle(messageConfig.title)
                    .setDescription(messageConfig.description)
                    .setColor(0x00FF00) // Color verde fijo por ahora
                    .setTimestamp();

                // Crear los componentes
                const components = [];
                if (messageConfig.components) {
                    const row = new ActionRowBuilder();
                    messageConfig.components.forEach(component => {
                        if (component.type === 'button') {
                            const button = new ButtonBuilder()
                                .setCustomId('verify_button') // Cambiado a un ID más específico
                                .setLabel(component.label)
                                .setStyle(ButtonStyle[component.style])
                                .setEmoji(component.emoji);
                            row.addComponents(button);
                        }
                    });
                    components.push(row);
                }

                // Enviar el mensaje
                const message = await channel.send({
                    embeds: [embed],
                    components: components
                });

                // Guardar en la base de datos
                await db.run(
                    'INSERT INTO staticMessages (id, channel_id, alias, message_data) VALUES (?, ?, ?, ?)',
                    [message.id, channel.id, alias, JSON.stringify(messageConfig)]
                );

                console.log(`✅ Mensaje ${alias} enviado y guardado correctamente`);
            }
        } catch (error) {
            console.error('Error al verificar y enviar mensajes estáticos:', error);
            throw error; // Re-lanzar el error para manejarlo en setup.js
        }
    }
}

module.exports = StaticMessageManager; 