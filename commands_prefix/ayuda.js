const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ayuda',
  description: 'Muestra la radio de emergencia con información de ayuda',
  
  async execute(message, args) {
    const embed = new EmbedBuilder()
      .setTitle('📻 Radio de Emergencia - Ayuda')
      .setDescription('¡Aquí tienes los comandos disponibles para sobrevivir en este mundo hostil!')
      .setColor(0x3498DB)
      .addFields(
        { 
          name: '!ping', 
          value: 'Verifica si el bot está vivo o es un zombie más', 
          inline: false 
        },
        { 
          name: '!superviviente [usuario]', 
          value: 'Muestra tu ficha de superviviente o la de otro usuario', 
          inline: false 
        },
        { 
          name: '!botiquin', 
          value: 'Recibe un consejo aleatorio de supervivencia para DayZ', 
          inline: false 
        },
        { 
          name: '!anuncio [mensaje] [canal|alias]', 
          value: 'Envía un anuncio con formato de transmisión de emergencia usando un canal directo o por alias configurado (solo moderadores)', 
          inline: false 
        },
        { 
          name: '!ayuda', 
          value: 'Muestra este mensaje de ayuda', 
          inline: false 
        }
      )
      .setFooter({ text: 'DZ Vigilant - Tu compañero de supervivencia' })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  },
}; 