const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendMessage, sendMessageToChannel_byAlias } = require('../extras/tools/messageUtils');

const declareModule = {
    name: 'anuncio',
    description: 'Envía un anuncio importante a un canal específico',
    isEnabled: true,
    restriction: {
        roles: [], // Solo administradores pueden usar este comando
        ids: []    // No hay IDs específicos
    }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName(declareModule.name)
    .setDescription(declareModule.description)
    .addStringOption(option => 
      option
        .setName('mensaje')
        .setDescription('El mensaje de anuncio a enviar')
        .setRequired(true))
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('El canal donde enviar el anuncio')
        .setRequired(false))
    .addStringOption(option =>
      option
        .setName('alias')
        .setDescription('Alias del canal configurado (alternativa a seleccionar canal)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  
  declareModule: declareModule,
  
  async execute(interaction) {
    // Obtener opciones
    const mensaje = interaction.options.getString('mensaje');
    const canal = interaction.options.getChannel('canal');
    const alias = interaction.options.getString('alias');
    
    // Formatear mensaje con temática de DayZ
    const mensajeFormateado = `📢 **TRANSMISIÓN DE EMERGENCIA**\n\n${mensaje}\n\n*Mensaje transmitido por ${interaction.user.username} a través del sistema de radio de emergencia.*`;
    
    try {
      // Decidir si usar el canal directamente o por alias
      if (alias) {
        // Usar el alias para enviar el mensaje
        await sendMessageToChannel_byAlias(interaction.client, alias, mensajeFormateado);
        await interaction.reply({ 
          content: `✅ Mensaje de emergencia enviado con éxito al canal con alias "${alias}".`, 
          ephemeral: true 
        });
      } else if (canal) {
        // Usar el canal seleccionado
        await sendMessage(mensajeFormateado, canal);
        await interaction.reply({ 
          content: `✅ Mensaje de emergencia enviado con éxito al canal ${canal}.`, 
          ephemeral: true 
        });
      } else {
        // Usar el canal actual
        await sendMessage(mensajeFormateado, interaction.channel);
        await interaction.reply({ 
          content: `✅ Mensaje de emergencia enviado con éxito al canal actual.`, 
          ephemeral: true 
        });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        content: '❌ ¡Error al transmitir el mensaje! La señal de radio puede estar interferida.', 
        ephemeral: true 
      });
    }
  },
}; 