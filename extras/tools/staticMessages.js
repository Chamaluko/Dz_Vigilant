const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { RoleBot, ChannelBot, StaticMessage } = require('../database/models');
const defaults = require('../../config/defaults.json');

class StaticMessageManager {
    
    /**
     * Maneja la selección dinámica de canal para mensajes administrativos usando la misma dinámica del setup
     */
    static async handleAdministrativeChannel(interaction, alias, messageConfig) {
        // Obtener todos los canales existentes
        const existingChannels = interaction.guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildText)
            .map(channel => ({
                label: channel.name,
                description: `ID: ${channel.id}`,
                value: channel.id,
                emoji: '📝'
            }));

        const channelSelect = new StringSelectMenuBuilder()
            .setCustomId(`admin_channel_${alias}`)
            .setPlaceholder(`Selecciona canal para: ${messageConfig.title}`)
            .addOptions([
                {
                    label: 'Crear nuevo canal',
                    description: `Crear un nuevo canal para este mensaje`,
                    value: 'create',
                    emoji: '🆕'
                },
                {
                    label: 'Omitir mensaje',
                    description: 'No enviar este mensaje administrativo',
                    value: 'skip',
                    emoji: '⏭️'
                }
            ]);

        // Agregar canales existentes (máximo 23 para dejar espacio a las opciones fijas)
        const maxChannels = Math.min(existingChannels.length, 23);
        channelSelect.addOptions(existingChannels.slice(0, maxChannels));

        const row = new ActionRowBuilder().addComponents(channelSelect);
        
        const embed = new EmbedBuilder()
            .setTitle(`🏛️ Configuración Administrativa`)
            .setDescription(`**Mensaje:** ${messageConfig.title}\n\n${messageConfig.description.substring(0, 500)}${messageConfig.description.length > 500 ? '...' : ''}\n\n**Selecciona el canal donde enviar este mensaje administrativo:**`)
            .setColor(0xFF6B6B)
            .setTimestamp();

        const channelMessage = await interaction.followUp({
            embeds: [embed],
            components: [row]
        });

        const filter = i => i.user.id === interaction.user.id;
        const response = await channelMessage.awaitMessageComponent({ filter, time: 300000 });
        const selectedValue = response.values[0];

        if (selectedValue === 'create') {
            // Crear nuevo canal administrativo con permisos privados
            const channelName = `admin-${alias}`;
            
            // Obtener el rol dueño para restricciones
            const ownerRole = await RoleBot.findByAlias(defaults.rolesBot.dueño.alias);
            let permissionOverwrites = [
                {
                    id: interaction.guild.id, // @everyone
                    deny: ['ViewChannel']
                }
            ];
            
            // Si existe el rol dueño, darle permisos completos
            if (ownerRole && ownerRole.id !== 'SKIPPED') {
                permissionOverwrites.push({
                    id: ownerRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'ManageMessages']
                });
                console.log(`🔒 [ADMIN-MSG] Canal administrativo será creado con restricciones - Solo visible para rol dueño: ${ownerRole.id}`);
            } else {
                console.log(`⚠️ [ADMIN-MSG] Rol dueño no encontrado, canal administrativo será creado sin restricciones especiales`);
            }
            
            const newChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                reason: `Canal administrativo para: ${messageConfig.title} - Solo visible para rol dueño`,
                permissionOverwrites: permissionOverwrites
            });

            // ¡IMPORTANTE! Guardar el canal en la base de datos
            const channelDoc = new ChannelBot({
                alias: alias, // Usar el alias del mensaje como alias del canal
                id: newChannel.id,
                name: newChannel.name,
                type: 'text',
                category: newChannel.parent?.name || null
            });
            await channelDoc.save();
            
            console.log(`💾 [ADMIN-MSG] Canal administrativo guardado en BD: ${newChannel.name} con alias: ${alias}`);

            await response.update({ components: [] });
            return newChannel;
        } else if (selectedValue === 'skip') {
            await response.update({ components: [] });
            return null;
        } else {
            // Usar canal existente
            const existingChannel = interaction.guild.channels.cache.get(selectedValue);
            await response.update({ components: [] });
            return existingChannel;
        }
    }

    static async checkAndSendMessages(client, setupInteraction = null) {
        try {
            // Obtener todos los mensajes estáticos configurados
            const staticMessages = defaults.staticMessages;
            
            // Separar mensajes normales y administrativos
            const normalMessages = {};
            const adminMessages = {};
            
            for (const [alias, messageConfig] of Object.entries(staticMessages)) {
                if (messageConfig.administrative === true) {
                    adminMessages[alias] = messageConfig;
                } else {
                    normalMessages[alias] = messageConfig;
                }
            }

            // Procesar mensajes normales primero
            for (const [alias, messageConfig] of Object.entries(normalMessages)) {
                // Verificar si el mensaje ya existe en la base de datos
                const existingMessage = await StaticMessage.findByAlias(alias);
                
                if (existingMessage) {
                    // Verificar si el mensaje aún existe en el canal
                    const channel = await client.channels.fetch(existingMessage.channel_id);
                    if (channel) {
                        try {
                            const message = await channel.messages.fetch(existingMessage.id);
                            if (message) {
                                console.log(`⏭️ [STATIC] Mensaje "${alias}" ya existe en #${channel.name}`);
                                continue; // El mensaje existe, continuar con el siguiente
                            }
                        } catch (error) {
                            // El mensaje no existe, lo eliminamos de la base de datos
                            await StaticMessage.deleteOne({ _id: existingMessage._id });
                            console.log(`🗑️ [STATIC] Mensaje "${alias}" eliminado de BD (no existe en Discord)`);
                        }
                    }
                }

                // Obtener el canal correspondiente desde la configuración del mensaje
                let channelConfig;
                const channelAlias = messageConfig.channel;
                
                if (channelAlias) {
                    channelConfig = await ChannelBot.findByAlias(channelAlias);
                } else {
                    console.log(`❌ No se especificó canal para el mensaje ${alias}`);
                    continue;
                }

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
                    .setColor(messageConfig.color ? parseInt(messageConfig.color, 16) : 0x00FF00)
                    .setTimestamp();

                // Crear los componentes
                const components = [];
                if (messageConfig.components) {
                    const row = new ActionRowBuilder();
                    messageConfig.components.forEach(component => {
                        if (component.type === 'button') {
                            const button = new ButtonBuilder()
                                .setCustomId(component.customId) // Usar el customId dinámico del componente
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
                const messageDoc = new StaticMessage({
                    id: message.id,
                    channel_id: channel.id,
                    alias: alias,
                    message_data: JSON.stringify(messageConfig)
                });
                await messageDoc.save();

                console.log(`✅ Mensaje ${alias} enviado y guardado correctamente`);
            }

            // Procesar mensajes administrativos con selección dinámica
            if (Object.keys(adminMessages).length > 0 && setupInteraction) {
                console.log('\n🏛️ Procesando mensajes administrativos...');
                
                for (const [alias, messageConfig] of Object.entries(adminMessages)) {
                    // Verificar si el mensaje ya existe en la base de datos
                    const existingMessage = await StaticMessage.findByAlias(alias);
                    
                    if (existingMessage) {
                        // Verificar si el mensaje aún existe en el canal
                        try {
                            const existingChannel = await client.channels.fetch(existingMessage.channel_id);
                            if (existingChannel) {
                                const message = await existingChannel.messages.fetch(existingMessage.id);
                                if (message) {
                                    console.log(`⏭️ [ADMIN] Mensaje "${alias}" ya existe en #${existingChannel.name}`);
                                    continue; // El mensaje existe, continuar con el siguiente
                                }
                            }
                        } catch (error) {
                            // El mensaje no existe, lo eliminamos de la base de datos
                            await StaticMessage.deleteOne({ _id: existingMessage._id });
                            console.log(`🗑️ [ADMIN] Mensaje "${alias}" eliminado de BD (no existe en Discord)`);
                        }
                    }

                    // Primero intentar buscar el canal en la base de datos (como los mensajes normales)
                    let selectedChannel = null;
                    const channelAlias = messageConfig.channel || alias; // Usar el alias del mensaje como fallback
                    
                    const channelConfig = await ChannelBot.findByAlias(channelAlias);
                    if (channelConfig && channelConfig.id !== 'SKIPPED') {
                        try {
                            selectedChannel = await client.channels.fetch(channelConfig.id);
                            console.log(`✅ [ADMIN] Canal encontrado en BD para "${alias}": #${selectedChannel.name}`);
                        } catch (error) {
                            console.log(`⚠️ [ADMIN] Canal en BD no accesible para "${alias}", usando selección dinámica`);
                        }
                    }
                    
                    // Si no se encuentra en BD, usar selección dinámica
                    if (!selectedChannel) {
                        selectedChannel = await this.handleAdministrativeChannel(setupInteraction, alias, messageConfig);
                        
                        if (!selectedChannel) {
                            console.log(`⏭️ [ADMIN] Mensaje "${alias}" omitido por el usuario`);
                            continue;
                        }
                    }

                    // Crear el embed
                    const embed = new EmbedBuilder()
                        .setTitle(messageConfig.title)
                        .setDescription(messageConfig.description)
                        .setColor(messageConfig.color ? parseInt(messageConfig.color, 16) : 0xFF6B6B)
                        .setTimestamp();

                    // Crear los componentes
                    const components = [];
                    if (messageConfig.components) {
                        const row = new ActionRowBuilder();
                        messageConfig.components.forEach(component => {
                            if (component.type === 'button') {
                                const button = new ButtonBuilder()
                                    .setCustomId(component.customId)
                                    .setLabel(component.label)
                                    .setStyle(ButtonStyle[component.style])
                                    .setEmoji(component.emoji);
                                row.addComponents(button);
                            }
                        });
                        components.push(row);
                    }

                    // Enviar el mensaje
                    const message = await selectedChannel.send({
                        embeds: [embed],
                        components: components
                    });

                    // Guardar en la base de datos
                    const messageDoc = new StaticMessage({
                        id: message.id,
                        channel_id: selectedChannel.id,
                        alias: alias,
                        message_data: JSON.stringify(messageConfig)
                    });
                    await messageDoc.save();

                    console.log(`✅ [ADMIN] Mensaje "${alias}" enviado a #${selectedChannel.name} y guardado correctamente`);
                }
            }

        } catch (error) {
            console.error('Error al verificar y enviar mensajes estáticos:', error);
            throw error; // Re-lanzar el error para manejarlo en setup.js
        }
    }
}

module.exports = StaticMessageManager; 