const fs = require('fs');
const path = require('path');

// Intentamos cargar botChannels de manera segura
let botChannels = [];
try {
    const configPath = path.join(__dirname, '../../config/defaults.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    botChannels = Object.entries(configData.channelsBot).map(([alias, config]) => ({
        alias,
        ...config
    }));
} catch (error) {
    console.error(`Error al cargar botChannels: ${error.message}`);
}

/**
 * Envía un mensaje a un canal específico
 * @param {string} message - El mensaje a enviar
 * @param {object} channel - El objeto del canal donde enviar el mensaje
 * @returns {Promise<Message>} - La promesa del mensaje enviado
 */
async function sendMessage(message, channel) {
  try {
    if (!channel) {
      console.error('No se ha proporcionado un canal válido');
      return null;
    }
    
    return await channel.send(message);
  } catch (error) {
    console.error(`Error al enviar mensaje: ${error.message}`);
    return null;
  }
}

/**
 * Envía un mensaje a un canal del sistema por su ID
 * @param {Client} client - El cliente de Discord
 * @param {string} channelId - ID del canal donde enviar el mensaje
 * @param {string} message - El mensaje a enviar
 */
async function sendSystemMessage(client, channelId, message) {
  try {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      await sendMessage(message, channel);
    } else {
      console.error(`Canal con ID ${channelId} no encontrado`);
    }
  } catch (error) {
    console.error(`Error al enviar mensaje de sistema: ${error.message}`);
  }
}

/**
 * Obtiene información de un canal por su alias
 * @param {string} alias - Alias del canal en la configuración
 * @returns {Object|null} - Información del canal o null si no se encuentra
 */
function getInfoBotChannel_byAlias(alias) {
  if (!botChannels || !Array.isArray(botChannels) || botChannels.length === 0) {
    console.warn('No hay canales configurados disponibles');
    return null;
  }
  
  const channel = botChannels.find(channel => channel.alias === alias);
  return channel || null;
}

function getBotChannel_byAlias(client, alias) {
  const infoChannel = getInfoChannel_byAlias(alias);
  if (!infoChannel) {
    console.error(`No se encontró canal con alias "${alias}"`);
    return null;
  }
  return client.channels.cache.get(infoChannel.id);
}

/**
 * Envía un mensaje a un canal por su alias
 * @param {Client} client - El cliente de Discord
 * @param {string} alias - Alias del canal en la configuración
 * @param {string} message - El mensaje a enviar
 */
async function sendMessageToBotChannel_byAlias(client, alias, message) {
  const channelInfo = getInfoBotChannel_byAlias(alias);
  
  if (!channelInfo) {
    console.error(`No se encontró canal con alias "${alias}"`);
    return null;
  }
  
  return await sendSystemMessage(client, channelInfo.id, message);
}

async function sendMessageToBotChannel_byAlias_with_embed(client, alias, message, embed) {
  const channelInfo = getInfoBotChannel_byAlias(alias);

  if (!channelInfo) {
    console.error(`No se encontró canal con alias "${alias}"`);
    return null;
  }

  try {
    const channel = client.channels.cache.get(channelInfo.id);
    if (!channel) {
      console.error(`Canal con ID ${channelInfo.id} no encontrado`);
      return null;
    }

    if (embed) {
      await channel.send({ content: message, embeds: [embed] });
    } else {
      await channel.send(message);
    }
    
    return true;
  } catch (error) {
    console.error(`Error al enviar mensaje con embed: ${error.message}`);
    return null;
  }
}

module.exports = {
  sendMessage,
  sendSystemMessage,
  getInfoBotChannel_byAlias,
  getBotChannel_byAlias, 
  sendMessageToBotChannel_byAlias,
  sendMessageToBotChannel_byAlias_with_embed
};