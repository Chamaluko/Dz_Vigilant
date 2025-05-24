const { Events } = require('discord.js');
const db = require('../extras/database/indexDB');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      // Verificar y crear tablas si es necesario
      await db.ensureTables();
      
      console.log(`✅ ${client.user.tag} está listo!`);

      const randomNumber = Math.floor(Math.random() * 100); //random de 0 a 100
      let message = `¡${client.user.tag} conectado y preparado para `;
      if (randomNumber <= 10) {
        message = message + 'matar!';
      } else {
        message = message + 'ayudar!';
      }
      console.log(`${message}`);

      // Establecer estado personalizado relacionado con DayZ
      client.user.setPresence({
        activities: [{
          name: 'Vigilando las calles',
          type: 4 // Custom Status
        }],
        status: 'online',
      });
    } catch (error) {
      console.error('Error al iniciar el bot:', error);
    }
  },
}; 