const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'superviviente',
  description: 'Muestra tu ficha de superviviente o la de otro usuario',
  
  async execute(message, args) {
    // Obtener el usuario objetivo (mencionado o el autor del mensaje)
    const target = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(target.id);
    
    // Calcular "estadísticas" aleatorias con temática de DayZ
    const salud = Math.floor(Math.random() * 100);
    const hambre = Math.floor(Math.random() * 100);
    const sed = Math.floor(Math.random() * 100);
    const infectado = Math.random() > 0.7 ? "Sí 🧟" : "No ✅";
    
    // Crear un estado basado en la salud
    let estado = "Saludable";
    let color = 0x00FF00; // Verde
    
    if (salud < 25) {
      estado = "Crítico";
      color = 0xFF0000; // Rojo
    } else if (salud < 50) {
      estado = "Herido";
      color = 0xFF9900; // Naranja
    } else if (salud < 75) {
      estado = "Estable";
      color = 0xFFFF00; // Amarillo
    }
    
    // Crear el embed
    const embed = new EmbedBuilder()
      .setTitle(`Ficha de Superviviente: ${target.username}`)
      .setDescription(`Estado: **${estado}**`)
      .setColor(color)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '❤️ Salud', value: `${salud}%`, inline: true },
        { name: '🍖 Hambre', value: `${hambre}%`, inline: true },
        { name: '💧 Sed', value: `${sed}%`, inline: true },
        { name: '🧪 Infectado', value: infectado, inline: true },
        { name: '📅 Días Sobrevividos', value: `${Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24))}`, inline: true },
        { name: '🏆 Rango', value: member.roles.highest.name, inline: true }
      )
      .setFooter({ text: 'Sistema de Vigilancia DayZ' })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  },
}; 