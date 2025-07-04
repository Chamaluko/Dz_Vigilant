module.exports = {
  name: 'ping',
  description: 'Verifica si el bot está vivo o es un zombie más',
  
  async execute(message, args) {
    const sent = await message.reply('📻 Enviando señal de radio...');
    
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(message.client.ws.ping);
    
    // Determinar el estado del bot basado en la latencia
    let statusMessage;
    if (apiLatency < 0) {
      statusMessage = '¡Mierda! La infección está afectando mi sistema... Necesito ayuda médica urgente.';
    } else if (apiLatency > 1000) {
      statusMessage = '¡Estoy perdiendo la conexión! La infección se está propagando...';
    } else if (latency > 500) {
      statusMessage = 'Me siento... lento. La infección podría estar afectándome.';
    } else {
      statusMessage = 'Sigo vivo y no me he convertido en zombie... aún.';
    }
    
    await sent.edit(`📡 Señal recibida! Latencia: ${latency}ms. API: ${apiLatency}ms\n*${statusMessage}*`);
  },
}; 