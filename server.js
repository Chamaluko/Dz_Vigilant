const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const { ChannelBot } = require('./extras/database/models');

// Variable global para el cliente de Discord
let discordClient = null;

// Función para enviar mensaje al canal de status
async function sendStatusMessage() {
  try {
    if (!discordClient) return;

    // Obtener el canal de status desde la DB
    const statusChannel = await ChannelBot.findByAlias('status');
    if (!statusChannel) {
      console.log('[STATUS] No se encontró el canal de status en la DB');
      return;
    }

    const channel = await discordClient.channels.fetch(statusChannel.id);
    if (channel) {
      await channel.send('🤖 Bot activo y despierto - Ping realizado');
    }
  } catch (error) {
    console.error('[STATUS] Error al enviar mensaje de status:', error);
  }
}

app.get('/', (req, res) => {
  res.send('Bot activo y despierto 👀');
  sendStatusMessage(); // Enviar mensaje al canal cuando se hace ping
});

function keepAlive(client) {
  discordClient = client; // Guardar referencia al cliente
  app.listen(PORT, () => {
    console.log(`Servidor de ping escuchando en el puerto ${PORT}`);
  });
}

module.exports = keepAlive;
