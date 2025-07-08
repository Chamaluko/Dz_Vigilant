const { Events } = require('discord.js');
const { connectDB } = require('../extras/database/mongooseConnection');
const models = require('../extras/database/models');
const ErrorLogger = require('../extras/tools/errorLogger');
const { getGiveawayManager } = require('../extras/tools/giveawayManager');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      // Conectar a MongoDB una sola vez
      await connectDB();
      
      // Los modelos ya están cargados automáticamente
      console.log('✅ Modelos Mongoose listos');
      
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

      // 🔧 INICIALIZAR SISTEMA DE ERROR LOGGING
      console.log('🔧 Inicializando sistema de error logging...');
      global.errorLogger = new ErrorLogger(client);
      
      // 🏆 INICIALIZAR GESTOR DE SORTEOS
      console.log('🏆 Inicializando GiveawayManager...');
      const giveawayManager = getGiveawayManager(client);
      await giveawayManager.init();
      
      // Configurar canal hardcodeado automáticamente
      setTimeout(async () => {
        try {
          const guildChannels = client.guilds.cache.first()?.channels.cache;
          if (guildChannels) {
            const errorChannel = guildChannels.find(ch => 
              ch.name.toLowerCase().includes('error') || 
              ch.name.toLowerCase().includes('bot-error') ||
              ch.name.toLowerCase() === 'bot-errors'
            );
            
            if (errorChannel) {
              global.errorLogger.setHardcodedChannel(errorChannel.id);
              console.log(`🔧 Canal de errores configurado automáticamente: ${errorChannel.name}`);
            } else {
              console.warn('⚠️ No se encontró canal de errores automáticamente');
            }
          }
        } catch (error) {
          console.error('❌ Error al configurar canal hardcodeado:', error);
        }
      }, 3000); // Esperar 3 segundos para que el bot esté completamente listo
      
    } catch (error) {
      console.error('Error al iniciar el bot:', error);
    }
  },
}; 