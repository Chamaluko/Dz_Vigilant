const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { RoleBot, ChannelBot, StaticMessage } = require('../extras/database/models');
const fs = require('fs');
const path = require('path');
const StaticMessageManager = require('../extras/tools/staticMessages');

// Cargar configuración por defecto
const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/defaults.json'), 'utf8'));

const declareModule = {
    name: 'setup',
    description: 'Configura el bot y los roles necesarios para el servidor',
    isEnabled: true,
    restriction: {
        roles: ['dueño'], // Solo el dueño puede ejecutar setup
        ids: ["1363226308439576777", "493284755157024768"]
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName(declareModule.name)
        .setDescription(declareModule.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    declareModule: declareModule,

    async execute(interaction) {
        try {
            const guild = interaction.guild;
            
            // Limpiar mensajes estáticos de canales inválidos antes de empezar
            await cleanupInvalidStaticMessages(interaction.client);
            
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Configuración del Bot')
                .setDescription('Vamos a configurar los roles y canales necesarios.\n\n' +
                    'Para cada rol y canal, podrás:\n' +
                    '• Seleccionar uno existente\n' +
                    '• Crear uno nuevo\n' +
                    '• Marcar como no necesario\n\n' +
                    'Comencemos con la selección de roles...')
                .setColor(0x3498DB)
                .setTimestamp();

            // Editar la respuesta diferida
            await interaction.editReply({ embeds: [embed] });

            // Configurar roles
            await setupRoles(interaction, embed);

        } catch (error) {
            console.error('Error en la configuración:', error);
            await interaction.editReply({
                content: '❌ Hubo un error durante la configuración. Por favor, verifica los permisos del bot y vuelve a intentarlo.'
            });
        }
    }
};

async function setupRoles(interaction, embed) {
    const roles = {};
    const roleEntries = Object.entries(defaults.rolesBot);

    for (const [alias, roleConfig] of roleEntries) {
        // Verificar si el rol ya existe en la base de datos
        const existingRole = await RoleBot.findByAlias(roleConfig.alias);
        if (existingRole) {
            // Si está marcado como omitido, saltarlo
            if (existingRole.id === 'SKIPPED') {
                console.log(`Rol ${roleConfig.alias} marcado como omitido, saltando...`);
                continue;
            }
            
            // Verificar si el rol realmente existe en Discord
            const discordRole = interaction.guild.roles.cache.get(existingRole.id);
            if (discordRole) {
                console.log(`Rol ${roleConfig.alias} ya configurado y válido, saltando...`);
                continue;
            } else {
                console.log(`Rol ${roleConfig.alias} configurado pero no existe en Discord, limpiando BD...`);
                // Eliminar el rol inválido de la BD para reconfiguración MANUAL
                await RoleBot.deleteOne({ _id: existingRole._id });
                // Continuar con el proceso manual normal
            }
        }

        const roleSelect = new StringSelectMenuBuilder()
            .setCustomId(`role_${alias}`)
            .setPlaceholder(`Selecciona el rol ${roleConfig.name}`)
            .addOptions([
                {
                    label: 'Crear nuevo rol',
                    description: `Crea un nuevo rol ${roleConfig.name}`,
                    value: 'create',
                    emoji: '🆕'
                },
                {
                    label: 'No necesario',
                    description: 'Marcar este rol como no necesario',
                    value: 'skip',
                    emoji: '⏭️'
                }
            ]);

        // Agregar roles existentes en grupos de 23 (25 - 2 opciones fijas)
        const existingRoles = interaction.guild.roles.cache
            .filter(role => !role.managed && role.name !== '@everyone')
            .map(role => ({
                label: role.name,
                description: `ID: ${role.id}`,
                value: role.id,
                emoji: '👑'
            }));

        // Dividir los roles en grupos de 23
        for (let i = 0; i < existingRoles.length; i += 23) {
            const roleGroup = existingRoles.slice(i, i + 23);
            roleSelect.addOptions(roleGroup);
        }

        const row = new ActionRowBuilder().addComponents(roleSelect);
        await interaction.editReply({
            embeds: [embed.setDescription(`Configurando rol: ${roleConfig.name}\n${roleConfig.description}`)],
            components: [row]
        });

        const filter = i => i.user.id === interaction.user.id;
        const response = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
        const selectedValue = response.values[0];

        if (selectedValue === 'create') {
            // Crear nuevo rol
            const newRole = await interaction.guild.roles.create({
                name: roleConfig.name,
                color: roleConfig.color,
                hoist: roleConfig.hoist,
                reason: 'Configuración inicial del bot'
            });

            // Guardar en la base de datos
            const roleDoc = new RoleBot({
                alias: roleConfig.alias,
                id: newRole.id,
                name: newRole.name,
                type: 'custom',
                permissions: JSON.stringify([])
            });
            await roleDoc.save();

            roles[alias] = newRole;
        } else if (selectedValue === 'skip') {
            // Guardar rol fantasma en la base de datos
            const roleDoc = new RoleBot({
                alias: roleConfig.alias,
                id: 'SKIPPED',
                name: roleConfig.name,
                type: 'custom',
                permissions: JSON.stringify([])
            });
            await roleDoc.save();
        } else {
            // Usar rol existente
            const existingRole = interaction.guild.roles.cache.get(selectedValue);
            
            // Guardar en la base de datos
            const roleDoc = new RoleBot({
                alias: roleConfig.alias,
                id: existingRole.id,
                name: existingRole.name,
                type: 'custom',
                permissions: JSON.stringify(existingRole.permissions.toArray())
            });
            await roleDoc.save();

            roles[alias] = existingRole;
        }

        await response.update({ components: [] });
    }

    // Continuar con la configuración de canales
    await setupChannels(interaction, embed);
}

async function setupChannels(interaction, embed) {
    const channels = {};
    const channelEntries = Object.entries(defaults.channelsBot);

    for (const [alias, channelConfig] of channelEntries) {
        // Verificar si el canal ya existe en la base de datos
        const existingChannel = await ChannelBot.findByAlias(channelConfig.alias);
        if (existingChannel) {
            // Si está marcado como omitido, saltarlo
            if (existingChannel.id === 'SKIPPED') {
                console.log(`Canal ${channelConfig.alias} marcado como omitido, saltando...`);
                continue;
            }
            
            // Verificar si el canal realmente existe en Discord
            const discordChannel = interaction.guild.channels.cache.get(existingChannel.id);
            if (discordChannel) {
                console.log(`Canal ${channelConfig.alias} ya configurado y válido, saltando...`);
                continue;
            } else {
                console.log(`Canal ${channelConfig.alias} configurado pero no existe en Discord, limpiando BD...`);
                // Eliminar el canal inválido de la BD para reconfiguración MANUAL
                await ChannelBot.deleteOne({ _id: existingChannel._id });
                // Continuar con el proceso manual normal
            }
        }

        // Obtener todos los canales existentes
        const existingChannels = interaction.guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildText)
            .map(channel => ({
                label: channel.name,
                description: `ID: ${channel.id}`,
                value: channel.id,
                emoji: '📝'
            }));

        // Dividir los canales en páginas de 10
        const channelsPerPage = 10;
        const totalPages = Math.ceil(existingChannels.length / channelsPerPage);
        let currentPage = 0;

        // Función para crear los botones de navegación
        function createNavigationButtons() {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀️ Anterior')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Siguiente ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('create')
                        .setLabel('🆕 Crear Nuevo')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('⏭️ No Necesario')
                        .setStyle(ButtonStyle.Secondary)
                );
        }

        // Función para mostrar la página actual
        async function showCurrentPage() {
            const start = currentPage * channelsPerPage;
            const end = start + channelsPerPage;
            const currentChannels = existingChannels.slice(start, end);

            const channelList = currentChannels.map((channel, index) => 
                `${index + 1}. ${channel.label} (ID: ${channel.value})`
            ).join('\n');

            const pageEmbed = new EmbedBuilder()
                .setTitle(`Configurando canal: ${channelConfig.name}`)
                .setDescription(`${channelConfig.description}\n\n**Canales disponibles (Página ${currentPage + 1}/${totalPages}):**\n${channelList}\n\nSelecciona un canal usando los botones numerados o las otras opciones.`)
                .setColor(0x3498DB)
                .setTimestamp();

            // Crear botones para los canales de la página actual
            const channelButtonRows = [];
            for (let i = 0; i < currentChannels.length; i += 5) {
                const row = new ActionRowBuilder();
                const channelGroup = currentChannels.slice(i, i + 5);
                
                channelGroup.forEach((channel, index) => {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`channel_${channel.value}`)
                            .setLabel(`${i + index + 1}`)
                            .setStyle(ButtonStyle.Secondary)
                    );
                });
                
                channelButtonRows.push(row);
            }

            // Agregar botones de navegación y opciones
            const navButtons = createNavigationButtons();

            await interaction.editReply({
                embeds: [pageEmbed],
                components: [...channelButtonRows, navButtons]
            });
        }

        // Mostrar la primera página
        await showCurrentPage();

        // Esperar la interacción del usuario
        const filter = i => i.user.id === interaction.user.id;
        let selectedValue = null;

        while (!selectedValue) {
            const response = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
            
            if (response.customId === 'prev' && currentPage > 0) {
                currentPage--;
                await showCurrentPage();
            } else if (response.customId === 'next' && currentPage < totalPages - 1) {
                currentPage++;
                await showCurrentPage();
            } else if (response.customId === 'create') {
                selectedValue = 'create';
            } else if (response.customId === 'skip') {
                selectedValue = 'skip';
            } else if (response.customId.startsWith('channel_')) {
                selectedValue = response.customId.split('_')[1];
            }

            await response.deferUpdate();
        }

        if (selectedValue === 'create') {
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
                console.log(`🔒 [SETUP] Canal será creado PRIVADO - Solo visible para rol dueño: ${ownerRole.id}`);
            } else {
                console.log(`⚠️ [SETUP] Rol dueño no encontrado, canal será creado sin restricciones especiales`);
            }

            // Crear nuevo canal SIEMPRE PRIVADO
            const newChannel = await interaction.guild.channels.create({
                name: channelConfig.name.toLowerCase(),
                type: ChannelType.GuildText,
                reason: 'Configuración inicial del bot - Canal PRIVADO solo visible para rol dueño',
                permissionOverwrites: permissionOverwrites
            });

            // Guardar en la base de datos
            const channelDoc = new ChannelBot({
                alias: channelConfig.alias,
                id: newChannel.id,
                name: newChannel.name,
                type: channelConfig.type,
                category: null
            });
            await channelDoc.save();

            console.log(`✅ [SETUP] Canal creado con restricciones: ${newChannel.name} - Solo visible para rol dueño`);
            channels[alias] = newChannel;
        } else if (selectedValue === 'skip') {
            // Guardar canal fantasma en la base de datos
            const channelDoc = new ChannelBot({
                alias: channelConfig.alias,
                id: 'SKIPPED',
                name: channelConfig.name,
                type: channelConfig.type,
                category: null
            });
            await channelDoc.save();
        } else {
            // Usar canal existente
            const existingChannel = interaction.guild.channels.cache.get(selectedValue);
            
            // Guardar en la base de datos
            const channelDoc = new ChannelBot({
                alias: channelConfig.alias,
                id: existingChannel.id,
                name: existingChannel.name,
                type: channelConfig.type,
                category: existingChannel.parent?.name || null
            });
            await channelDoc.save();

            channels[alias] = existingChannel;
        }

        await interaction.editReply({ components: [] });
    }

    // Mostrar mensaje de finalización
    const finalEmbed = new EmbedBuilder()
        .setTitle('✅ Configuración Completada')
        .setDescription('La configuración del bot se ha completado exitosamente.')
        .setColor(0x00FF00)
        .setTimestamp();

    await interaction.editReply({ embeds: [finalEmbed] });

    // Iniciar configuración de mensajes estáticos
    const messagesEmbed = new EmbedBuilder()
        .setTitle('📝 Configurando Mensajes Estáticos')
        .setDescription('Configurando los mensajes iniciales del bot...')
        .setColor(0x3498DB)
        .setTimestamp();

    await interaction.followUp({ embeds: [messagesEmbed] });

    try {
        await StaticMessageManager.checkAndSendMessages(interaction.client, interaction);
        
        const successEmbed = new EmbedBuilder()
            .setTitle('✨ Configuración Finalizada')
            .setDescription('Todos los mensajes estáticos han sido configurados correctamente.')
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.followUp({ embeds: [successEmbed] });
    } catch (error) {
        console.error('Error al configurar mensajes estáticos:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error en la Configuración')
            .setDescription('Hubo un error al configurar los mensajes estáticos. Por favor, contacta a un administrador.')
            .setColor(0xFF0000)
            .setTimestamp();

        await interaction.followUp({ embeds: [errorEmbed] });
    }
}

/**
 * Limpia mensajes estáticos de canales que no existen
 */
async function cleanupInvalidStaticMessages(client = null) {
    try {
        console.log('🧹 [SETUP] Limpiando mensajes estáticos de canales inválidos...');
        
        const staticMessages = await StaticMessage.find();
        let cleanedCount = 0;
        
        for (const staticMsg of staticMessages) {
            if (staticMsg.channel_id !== 'SKIPPED') {
                let shouldDelete = false;
                let deleteReason = '';
                
                // Verificar si el canal existe en la BD
                const channelExists = await ChannelBot.findOne({ id: staticMsg.channel_id });
                if (!channelExists) {
                    shouldDelete = true;
                    deleteReason = 'canal no existe en BD';
                } else if (client) {
                    // Si tenemos cliente, verificar si el mensaje realmente existe en Discord
                    try {
                        const channel = await client.channels.fetch(staticMsg.channel_id);
                        if (channel) {
                            await channel.messages.fetch(staticMsg.id);
                        } else {
                            shouldDelete = true;
                            deleteReason = 'canal no existe en Discord';
                        }
                    } catch (error) {
                        shouldDelete = true;
                        deleteReason = 'mensaje no existe en Discord';
                    }
                }
                
                if (shouldDelete) {
                    await StaticMessage.deleteOne({ _id: staticMsg._id });
                    console.log(`🗑️ [SETUP] Mensaje estático eliminado: ${staticMsg.alias} (${deleteReason})`);
                    cleanedCount++;
                }
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`✅ [SETUP] Se limpiaron ${cleanedCount} mensajes estáticos inválidos`);
        } else {
            console.log('✅ [SETUP] No hay mensajes estáticos inválidos para limpiar');
        }
    } catch (error) {
        console.error('❌ [SETUP] Error al limpiar mensajes estáticos:', error);
    }
} 