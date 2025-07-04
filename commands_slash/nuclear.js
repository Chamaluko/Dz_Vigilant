const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const devId = "1363226308439576777";

const declareModule = {
    name: 'nuclear',
    description: '🚨 COMANDO DESTRUCTIVO: Elimina TODOS los canales del servidor - USO EXTREMO',
    isEnabled: true,
    restriction: {
        roles: [], // No usar roles para este comando
        ids: [devId] // 🔒 SOLO ESTA ID ESPECÍFICA PUEDE USAR ESTE COMANDO
    }
};



module.exports = {
    data: new SlashCommandBuilder()
        .setName(declareModule.name)
        .setDescription(declareModule.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('confirmacion')
                .setDescription('Escribe "ELIMINAR" para confirmar')
                .setRequired(true)
        ),

    declareModule: declareModule,
    executeNuclearDestruction: executeNuclearDestruction,

    async execute(interaction) {
        try {
            // 🔒 VERIFICACIÓN ULTRA-RESTRICTIVA DE ID
            if (interaction.user.id !== devId) {
                await interaction.editReply({
                    content: '🚫 **ACCESO DENEGADO**\n\nEste comando está restringido a una ID específica.'
                });
                console.log(`🚨 [NUCLEAR] Intento de acceso no autorizado por ${interaction.user.username} (${interaction.user.id})`);
                return;
            }

            // 🔒 VERIFICACIÓN DE CONFIRMACIÓN
            const confirmacion = interaction.options.getString('confirmacion');
            if (confirmacion !== 'ELIMINAR') {
                await interaction.editReply({
                    content: '❌ **Confirmación incorrecta**\n\nDebes escribir exactamente: `ELIMINAR`'
                });
                return;
            }

            // 🔒 VERIFICACIÓN FINAL CON BOTONES
            const warningEmbed = new EmbedBuilder()
                .setTitle('🚨 ADVERTENCIA FINAL')
                .setDescription('**ESTÁS A PUNTO DE ELIMINAR TODOS LOS CANALES DEL SERVIDOR**\n\n' +
                    '⚠️ **ESTA ACCIÓN ES IRREVERSIBLE**\n' +
                    '⚠️ **SE PERDERÁN TODOS LOS MENSAJES**\n' +
                    '⚠️ **SE PERDERÁN TODAS LAS CONFIGURACIONES**\n\n' +
                    `🏛️ **Servidor:** ${interaction.guild.name}\n` +
                    `📊 **Canales totales:** ${interaction.guild.channels.cache.size}\n` +
                    `👤 **Ejecutado por:** ${interaction.user.username}\n\n` +
                    '**¿Estás completamente seguro?**')
                .setColor(0xFF0000)
                .setTimestamp();

            const confirmButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('nuclear_confirm')
                        .setLabel('💥 SÍ, ELIMINAR TODO')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('nuclear_cancel')
                        .setLabel('❌ CANCELAR')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({
                embeds: [warningEmbed],
                components: [confirmButtons]
            });

            // Esperar confirmación final
            const filter = i => i.user.id === interaction.user.id;
            try {
                const response = await interaction.channel.awaitMessageComponent({ 
                    filter, 
                    time: 30000 // 30 segundos para decidir
                });

                if (response.customId === 'nuclear_cancel') {
                    await response.update({
                        content: '✅ **Operación cancelada**\n\nNo se eliminó ningún canal.',
                        embeds: [],
                        components: []
                    });
                    return;
                }

                if (response.customId === 'nuclear_confirm') {
                    await response.update({
                        content: '💥 **INICIANDO DESTRUCCIÓN NUCLEAR...**\n\n⏳ Eliminando todos los canales...',
                        embeds: [],
                        components: []
                    });

                    // 💥 EJECUTAR DESTRUCCIÓN TOTAL
                    await executeNuclearDestruction(interaction);
                }

            } catch (error) {
                await interaction.editReply({
                    content: '⏰ **Tiempo agotado**\n\nOperación cancelada por seguridad.',
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            console.error('❌ [NUCLEAR] Error en comando nuclear:', error);
            try {
                await interaction.editReply({
                    content: '❌ Error crítico durante la operación nuclear.'
                });
            } catch (editError) {
                console.error('❌ [NUCLEAR] Error adicional al enviar mensaje de error:', editError);
            }
        }
    }
};

async function executeNuclearDestruction(interaction) {
    try {
        console.log(`💥 [NUCLEAR] INICIANDO DESTRUCCIÓN TOTAL en ${interaction.guild.name} por ${interaction.user.username}`);
        
        const guild = interaction.guild;
        const channels = [...guild.channels.cache.values()];
        const totalChannels = channels.length;
        let deletedCount = 0;
        let errorCount = 0;

        // Crear un canal temporal para reportar el progreso
        let reportChannel = null;
        try {
            reportChannel = await guild.channels.create({
                name: '🚨nuclear-report',
                reason: 'Canal temporal para reportar destrucción nuclear'
            });
        } catch (error) {
            console.log('No se pudo crear canal de reporte');
        }

        // Función para reportar progreso
        async function reportProgress(message) {
            console.log(`💥 [NUCLEAR] ${message}`);
            if (reportChannel) {
                try {
                    await reportChannel.send(`💥 **NUCLEAR:** ${message}`);
                } catch (error) {
                    // Ignore si no se puede enviar
                }
            }
        }

        await reportProgress(`Iniciando eliminación de ${totalChannels} canales...`);

        // Eliminar canales en lotes para evitar rate limits
        for (const channel of channels) {
            // No eliminar el canal de reporte hasta el final
            if (channel.id === reportChannel?.id) continue;

            try {
                await channel.delete('💥 COMANDO NUCLEAR - Destrucción total');
                deletedCount++;
                
                if (deletedCount % 10 === 0) {
                    await reportProgress(`Progreso: ${deletedCount}/${totalChannels} canales eliminados`);
                }
                
                // Esperar un poco entre eliminaciones para evitar rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                errorCount++;
                console.error(`❌ [NUCLEAR] Error eliminando canal ${channel.name}:`, error);
            }
        }

        // Reporte final
        const finalReport = `🏁 **DESTRUCCIÓN COMPLETADA**\n\n` +
            `✅ **Canales eliminados:** ${deletedCount}\n` +
            `❌ **Errores:** ${errorCount}\n` +
            `📊 **Total original:** ${totalChannels}\n\n` +
            `👤 **Ejecutado por:** ${interaction.user.username}\n` +
            `🕐 **Hora:** ${new Date().toLocaleString('es-ES')}\n\n` +
            `**Este canal se auto-eliminará en 10 segundos...**`;

        await reportProgress(finalReport);

        // Auto-eliminar el canal de reporte después de 30 segundos
        setTimeout(async () => {
            try {
                if (reportChannel) {
                    await reportChannel.delete('💥 NUCLEAR - Auto-eliminación de reporte');
                }
            } catch (error) {
                console.error('Error eliminando canal de reporte:', error);
            }
        }, 10000);

        console.log(`💥 [NUCLEAR] DESTRUCCIÓN COMPLETADA: ${deletedCount}/${totalChannels} canales eliminados`);

    } catch (error) {
        console.error('❌ [NUCLEAR] Error crítico durante la destrucción:', error);
    }
} 