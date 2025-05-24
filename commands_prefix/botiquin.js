const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'botiquin',
  description: 'Recibe un consejo aleatorio de supervivencia para DayZ',
  
  async execute(message, args) {
    // Lista de consejos de supervivencia para DayZ
    const consejos = [
      "Siempre verifica los edificios antes de entrar. Nunca sabes quién o qué podría estar dentro.",
      "Mantén tu arma limpia y en buen estado. Un arma que se atasca podría significar tu muerte.",
      "El sigilo es clave. Si haces mucho ruido, atraerás zombies y otros jugadores.",
      "Lleva siempre vendas y desinfectante. Las infecciones pueden ser mortales.",
      "Aprende a cazar y pescar. La comida enlatada no durará para siempre.",
      "Nunca confíes en extraños. La mayoría te matará por tus recursos.",
      "Las ciudades grandes tienen mejor botín, pero también más peligros.",
      "El agua de arroyos y lagos debe ser purificada antes de beberla.",
      "La hipotermia es una amenaza real. Mantente seco y abrigado.",
      "Viaja ligero. Llevar demasiado peso te hará lento y vulnerable.",
      "Si escuchas disparos, aléjate. La curiosidad puede matarte.",
      "Aprende a orientarte con el sol y las estrellas para cuando no tengas brújula.",
      "Los helicópteros y aviones suelen estrellarse en lugares con buen botín.",
      "Conserva munición. Cada disparo atrae más problemas.",
      "Siempre ten un plan de escape cuando entres en zonas de alto riesgo."
    ];
    
    // Seleccionar un consejo aleatorio
    const consejoAleatorio = consejos[Math.floor(Math.random() * consejos.length)];
    
    const embed = new EmbedBuilder()
      .setTitle('🧰 Botiquín de Supervivencia')
      .setDescription(consejoAleatorio)
      .setColor(0xE74C3C)
      .setFooter({ text: 'Consejo patrocinado por DZ Vigilant' })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  },
}; 