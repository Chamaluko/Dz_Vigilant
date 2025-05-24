const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const declareModule = {
    name: 'verificar',
    description: 'Inicia el proceso de verificación de humanidad',
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  declareModule: declareModule,
  
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🧟 Verificación de Humanidad')
      .setDescription('Para verificar que eres humano y no un zombie, reacciona con el emoji 🧠 a este mensaje.\n\n' +
                     'Una vez verificado, tendrás acceso a los canales del servidor.')
      .setColor(0x3498DB)
      .setFooter({ text: 'DZ Vigilant - Sistema de Verificación' })
      .setTimestamp();

    const message = await interaction.channel.send({ embeds: [embed] });
    await message.react('🧠');
    
    // Guardar el ID del mensaje en la base de datos o en memoria
    // Por ahora lo guardaremos en una variable global del cliente
    if (!interaction.client.verificationMessages) {
      interaction.client.verificationMessages = new Map();
    }
    interaction.client.verificationMessages.set(message.id, {
      channelId: interaction.channel.id,
      guildId: interaction.guild.id
    });

    await interaction.reply({ 
      content: '✅ Sistema de verificación iniciado. Los usuarios pueden comenzar a verificarse.', 
      ephemeral: true 
    });
  },
}; 