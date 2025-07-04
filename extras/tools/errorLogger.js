const { EmbedBuilder, time } = require('discord.js');
const { ChannelBot } = require('../database/models');

/**
 * Sistema centralizado de logging de errores del bot
 */
class ErrorLogger {
  constructor(client) {
    this.client = client;
    this.errorCount = 0;
    this.startTime = Date.now();
    this.errorBuffer = []; // Buffer para errores cuando el canal no está disponible
    this.maxBufferSize = 50; // Máximo 50 errores en buffer
    this.hardcodedChannelId = null; // Canal hardcodeado como fallback
    
    // Inicializar listeners de errores
    this.setupErrorListeners();
    
    console.log('🔧 [ERROR-LOGGER] Sistema de captura de errores inicializado');
  }

  /**
   * Configurar todos los listeners de errores
   */
  setupErrorListeners() {
    // === ERRORES DE DISCORD.JS ===
    this.client.on('error', (error) => {
      console.error('❌ [DISCORD-ERROR]', error);
      this.logError(error, {
        type: 'DISCORD_CLIENT_ERROR',
        severity: 'CRITICAL',
        source: 'Discord.js Client'
      });
    });

    this.client.on('warn', (warning) => {
      console.warn('⚠️ [DISCORD-WARN]', warning);
      this.logWarning(warning, {
        type: 'DISCORD_WARNING',
        source: 'Discord.js Client'
      });
    });

    this.client.on('shardError', (error, shardId) => {
      console.error(`❌ [SHARD-ERROR] Shard ${shardId}:`, error);
      this.logError(error, {
        type: 'SHARD_ERROR',
        severity: 'CRITICAL',
        source: `Discord.js Shard ${shardId}`
      });
    });

    // === ERRORES DE PROCESO (GLOBALES) ===
    process.on('uncaughtException', (error, origin) => {
      console.error('❌ [UNCAUGHT-EXCEPTION]', error);
      this.logError(error, {
        type: 'UNCAUGHT_EXCEPTION',
        severity: 'CRITICAL',
        source: 'Node.js Process',
        origin: origin
      });
      
      // Para errores críticos, opcional: reiniciar el bot
      // process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ [UNHANDLED-REJECTION]', reason);
      this.logError(reason instanceof Error ? reason : new Error(String(reason)), {
        type: 'UNHANDLED_REJECTION',
        severity: 'HIGH',
        source: 'Node.js Process',
        promise: promise.toString()
      });
    });

    process.on('warning', (warning) => {
      console.warn('⚠️ [PROCESS-WARNING]', warning);
      this.logWarning(warning.message || warning, {
        type: 'PROCESS_WARNING',
        source: 'Node.js Process',
        name: warning.name
      });
    });

    console.log('✅ [ERROR-LOGGER] Event listeners configurados');
  }

  /**
   * Configurar canal de errores hardcodeado para fallback
   */
  setHardcodedChannel(channelId) {
    this.hardcodedChannelId = channelId;
    console.log(`🔧 [ERROR-LOGGER] Canal hardcodeado configurado: ${channelId}`);
  }

  /**
   * Log de errores (normales y críticos)
   */
  async logError(error, context = {}) {
    this.errorCount++;
    
    try {
      const severity = context.severity || 'NORMAL';
      const isCritical = ['CRITICAL', 'HIGH'].includes(severity);
      
      // Log en consola
      console.error(`❌ [${severity}] ${context.type || 'ERROR'}:`, error);
      
      // Enviar al canal de errores
      await this.sendToErrorChannel(error, context, isCritical);
      
    } catch (logError) {
      console.error('❌ [ERROR-LOGGER] Error al loggear error:', logError);
    }
  }

  /**
   * Log de advertencias
   */
  async logWarning(message, context = {}) {
    try {
      console.warn(`⚠️ [WARNING] ${context.type || 'WARN'}:`, message);
      await this.sendWarningToChannel(message, context);
    } catch (logError) {
      console.error('❌ [ERROR-LOGGER] Error al loggear warning:', logError);
    }
  }

  /**
   * Log de errores de interacciones (comandos/botones)
   */
  async logInteractionError(error, interaction) {
    await this.logError(error, {
      type: 'INTERACTION_ERROR',
      severity: 'NORMAL',
      source: 'Discord Interaction',
      user: `${interaction.user.username} (${interaction.user.id})`,
      guild: interaction.guild?.name || 'DM',
      command: interaction.commandName || interaction.customId || 'Unknown',
      channel: interaction.channel?.name || 'Unknown'
    });
  }

  /**
   * Buscar canal de errores (con múltiples fallbacks)
   */
  async findErrorChannel() {
    try {
      // Método 1: Intentar MongoDB primero
      try {
        const errorChannel = await ChannelBot.findByAlias('errors');
        if (errorChannel && !errorChannel.isSkipped()) {
          const channel = this.client.channels.cache.get(errorChannel.id);
          if (channel) {
            console.log(`✅ [ERROR-LOGGER] Canal encontrado via MongoDB: ${channel.name}`);
            return channel;
          }
        }
      } catch (mongoError) {
        console.warn('⚠️ [ERROR-LOGGER] MongoDB no disponible, usando fallbacks...');
      }

      // Método 2: Canal hardcodeado
      if (this.hardcodedChannelId) {
        const channel = this.client.channels.cache.get(this.hardcodedChannelId);
        if (channel) {
          console.log(`✅ [ERROR-LOGGER] Canal encontrado via hardcode: ${channel.name}`);
          return channel;
        }
      }

      // Método 3: Buscar por nombre
      const guildChannels = this.client.guilds.cache.first()?.channels.cache;
      if (guildChannels) {
        const channelByName = guildChannels.find(ch => 
          ch.name.toLowerCase().includes('error') || 
          ch.name.toLowerCase().includes('bot-error') ||
          ch.name.toLowerCase() === 'bot-errors'
        );
        if (channelByName) {
          console.log(`✅ [ERROR-LOGGER] Canal encontrado por nombre: ${channelByName.name}`);
          // Guardar para futuros usos
          this.hardcodedChannelId = channelByName.id;
          return channelByName;
        }
      }

      console.warn('⚠️ [ERROR-LOGGER] No se pudo encontrar canal de errores');
      return null;

    } catch (error) {
      console.error('❌ [ERROR-LOGGER] Error al buscar canal:', error);
      return null;
    }
  }

  /**
   * Enviar error al canal de errores
   */
  async sendToErrorChannel(error, context, isCritical = false) {
    try {
      const channel = await this.findErrorChannel();
      
      if (!channel) {
        console.warn('⚠️ [ERROR-LOGGER] Canal de errores no disponible - guardando en buffer');
        this.addToBuffer(error, context, isCritical);
        return;
      }

      // Determinar color según severidad
      const severityColors = {
        'CRITICAL': 0xFF0000,  // Rojo intenso
        'HIGH': 0xFF6B00,      // Naranja
        'NORMAL': 0xFFAA00,    // Amarillo
        'LOW': 0x00AAFF       // Azul
      };

      const severity = context.severity || 'NORMAL';
      const color = severityColors[severity];

      // Crear embed de error
      const errorEmbed = new EmbedBuilder()
        .setTitle(`${isCritical ? '🚨' : '❌'} Error del Bot ${isCritical ? '(CRÍTICO)' : ''}`)
        .setColor(color)
        .setTimestamp();

      // Información básica del error
      errorEmbed.addFields([
        { 
          name: '🔥 Severidad', 
          value: `**${severity}**${isCritical ? ' 🚨' : ''}`, 
          inline: true 
        },
        { 
          name: '📂 Tipo', 
          value: context.type || 'ERROR', 
          inline: true 
        },
        { 
          name: '📍 Fuente', 
          value: context.source || 'Desconocida', 
          inline: true 
        }
      ]);

      // Mensaje de error (truncado si es muy largo)
      const errorMessage = error.message || String(error);
      errorEmbed.addFields([
        { 
          name: '❌ Error', 
          value: `\`\`\`${errorMessage.slice(0, 1000)}${errorMessage.length > 1000 ? '...' : ''}\`\`\``, 
          inline: false 
        }
      ]);

      // Stack trace (solo para errores importantes)
      if (error.stack && ['CRITICAL', 'HIGH'].includes(severity)) {
        const stack = error.stack.slice(0, 1000);
        errorEmbed.addFields([
          { 
            name: '📋 Stack Trace', 
            value: `\`\`\`${stack}${error.stack.length > 1000 ? '...' : ''}\`\`\``, 
            inline: false 
          }
        ]);
      }

      // Información de contexto adicional
      if (context.user) {
        errorEmbed.addFields([
          { name: '👤 Usuario', value: context.user, inline: true }
        ]);
      }
      
      if (context.guild) {
        errorEmbed.addFields([
          { name: '🏛️ Servidor', value: context.guild, inline: true }
        ]);
      }
      
      if (context.command) {
        errorEmbed.addFields([
          { name: '🔧 Comando/Acción', value: context.command, inline: true }
        ]);
      }

      // Información del sistema
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      errorEmbed.addFields([
        { 
          name: '📊 Estadísticas', 
          value: `⏱️ Uptime: ${this.formatUptime(uptime)}\n🔢 Error #${this.errorCount}`, 
          inline: false 
        }
      ]);

      // Enviar al canal con mención de admin si es crítico
      let mentionContent = undefined;
      if (isCritical) {
        try {
          const { RoleBot } = require('../database/models');
          const adminRole = await RoleBot.findByAlias('admin');
          const ownerRole = await RoleBot.findByAlias('dueño');
          
          let mentions = [];
          if (adminRole && !adminRole.isSkipped()) {
            mentions.push(`<@&${adminRole.id}>`);
          }
          if (ownerRole && !ownerRole.isSkipped()) {
            mentions.push(`<@&${ownerRole.id}>`);
          }
          
          mentionContent = mentions.length > 0 
            ? `${mentions.join(' ')} 🚨 **ERROR CRÍTICO DEL BOT** 🚨`
            : '🚨 **ERROR CRÍTICO DEL BOT** 🚨';
        } catch (roleError) {
          console.warn('⚠️ [ERROR-LOGGER] No se pudo obtener roles para mención:', roleError);
          mentionContent = '🚨 **ERROR CRÍTICO DEL BOT** 🚨';
        }
      }

      await channel.send({ 
        embeds: [errorEmbed],
        content: mentionContent
      });

      console.log(`✅ [ERROR-LOGGER] Error #${this.errorCount} enviado al canal ${channel.name}`);

      // Si enviamos exitosamente Y hay errores en buffer, enviarlos también
      if (this.errorBuffer.length > 0) {
        await this.processBuffer(channel);
      }

    } catch (channelError) {
      console.error('❌ [ERROR-LOGGER] Error al enviar al canal:', channelError);
      
      // Guardar en buffer si falla el envío
      this.addToBuffer(error, context, isCritical);
      
      // Failsafe: Si no se puede enviar al canal, al menos loggear localmente con más detalle
      const timestamp = new Date().toLocaleString('es-ES');
      console.error(`🆘 [ERROR-LOGGER-FAILSAFE] ${timestamp} - Error #${this.errorCount}:`, error);
      console.error(`🆘 [ERROR-LOGGER-FAILSAFE] Contexto:`, context);
      console.error(`🆘 [ERROR-LOGGER-FAILSAFE] Es crítico:`, isCritical);
    }
  }

  /**
   * Enviar advertencia al canal
   */
  async sendWarningToChannel(message, context) {
    try {
      const channel = await this.findErrorChannel();
      if (!channel) return;

      const warningEmbed = new EmbedBuilder()
        .setTitle('⚠️ Advertencia del Bot')
        .setColor(0xFFAA00)
        .setTimestamp()
        .addFields([
          { name: '📂 Tipo', value: context.type || 'WARNING', inline: true },
          { name: '📍 Fuente', value: context.source || 'Desconocida', inline: true },
          { name: '⚠️ Mensaje', value: `\`\`\`${String(message).slice(0, 1000)}\`\`\``, inline: false }
        ]);

      await channel.send({ embeds: [warningEmbed] });

    } catch (error) {
      console.error('❌ [ERROR-LOGGER] Error al enviar warning:', error);
    }
  }

  /**
   * Agregar error al buffer cuando el canal no está disponible
   */
  addToBuffer(error, context, isCritical) {
    if (this.errorBuffer.length >= this.maxBufferSize) {
      // Si el buffer está lleno, remover el error más antiguo
      this.errorBuffer.shift();
      console.warn(`⚠️ [ERROR-LOGGER] Buffer lleno, removiendo error más antiguo`);
    }

    this.errorBuffer.push({
      error: error,
      context: context,
      isCritical: isCritical,
      timestamp: new Date(),
      bufferedAt: Date.now(),
      errorNumber: this.errorCount
    });

    console.log(`📦 [ERROR-LOGGER] Error #${this.errorCount} guardado en buffer (${this.errorBuffer.length}/${this.maxBufferSize})`);
  }

  /**
   * Procesar todos los errores del buffer cuando el canal esté disponible
   */
  async processBuffer(channel) {
    if (this.errorBuffer.length === 0) return;

    console.log(`📤 [ERROR-LOGGER] Procesando ${this.errorBuffer.length} errores del buffer...`);

    // Enviar mensaje de resumen del buffer
    const bufferSummaryEmbed = new EmbedBuilder()
      .setTitle('📦 Errores Recuperados del Buffer')
      .setDescription(`Se encontraron **${this.errorBuffer.length}** errores que no pudieron enviarse anteriormente debido a problemas de conectividad.`)
      .setColor(0xFFAA00)
      .addFields([
        { name: '⏰ Período', value: `Desde <t:${Math.floor(this.errorBuffer[0].bufferedAt/1000)}:R> hasta <t:${Math.floor(this.errorBuffer[this.errorBuffer.length-1].bufferedAt/1000)}:R>`, inline: false },
        { name: '📊 Total', value: `${this.errorBuffer.length} errores recuperados`, inline: true }
      ])
      .setTimestamp();

    try {
      await channel.send({ embeds: [bufferSummaryEmbed] });
    } catch (error) {
      console.error('❌ [ERROR-LOGGER] Error al enviar resumen del buffer:', error);
    }

    // Procesar cada error del buffer
    const bufferCopy = [...this.errorBuffer];
    this.errorBuffer = []; // Limpiar buffer

    for (const bufferedError of bufferCopy) {
      try {
        // Recrear el embed del error original con nota de que estaba en buffer
        const severity = bufferedError.context.severity || 'NORMAL';
        const isCritical = ['CRITICAL', 'HIGH'].includes(severity);
        
        const severityColors = {
          'CRITICAL': 0xFF0000,
          'HIGH': 0xFF6B00,
          'NORMAL': 0xFFAA00,
          'LOW': 0x00AAFF
        };

        const color = severityColors[severity];

        const errorEmbed = new EmbedBuilder()
          .setTitle(`📦 ${isCritical ? '🚨' : '❌'} Error Recuperado #${bufferedError.errorNumber} ${isCritical ? '(CRÍTICO)' : ''}`)
          .setColor(color)
          .setTimestamp(bufferedError.timestamp);

        // Información básica del error
        errorEmbed.addFields([
          { name: '🔥 Severidad', value: `**${severity}**${isCritical ? ' 🚨' : ''}`, inline: true },
          { name: '📂 Tipo', value: bufferedError.context.type || 'ERROR', inline: true },
          { name: '📍 Fuente', value: bufferedError.context.source || 'Desconocida', inline: true }
        ]);

        // Mensaje de error
        const errorMessage = bufferedError.error.message || String(bufferedError.error);
        errorEmbed.addFields([
          { name: '❌ Error', value: `\`\`\`${errorMessage.slice(0, 1000)}${errorMessage.length > 1000 ? '...' : ''}\`\`\``, inline: false }
        ]);

        // Nota de que era del buffer
        errorEmbed.addFields([
          { name: '📦 Buffer', value: `Error recuperado del buffer. Ocurrió <t:${Math.floor(bufferedError.bufferedAt/1000)}:R>`, inline: false }
        ]);

        await channel.send({ embeds: [errorEmbed] });
        
        // Pequeña pausa para evitar rate limits
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error('❌ [ERROR-LOGGER] Error al enviar error del buffer:', error);
      }
    }

    console.log(`✅ [ERROR-LOGGER] Buffer procesado: ${bufferCopy.length} errores enviados`);
  }

  /**
   * Formatear tiempo de uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    result += `${secs}s`;

    return result;
  }

  /**
   * Obtener estadísticas de errores
   */
  getStats() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      errorCount: this.errorCount,
      uptime: uptime,
      startTime: this.startTime,
      formattedUptime: this.formatUptime(uptime),
      bufferedErrors: this.errorBuffer.length
    };
  }

  /**
   * Obtener estadísticas detalladas de conectividad
   */
  getDetailedStats() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const client = this.client;
    
    return {
      // Estadísticas básicas
      errorCount: this.errorCount,
      uptime: uptime,
      startTime: this.startTime,
      formattedUptime: this.formatUptime(uptime),
      bufferedErrors: this.errorBuffer.length,
      
      // Estadísticas de Discord
      discordConnected: client.isReady(),
      discordPing: client.ws.ping,
      discordUptime: client.uptime ? Math.floor(client.uptime / 1000) : 0,
      discordGuilds: client.guilds.cache.size,
      
      // Estadísticas del sistema
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      
      // Estadísticas de proceso
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      
      // Información del canal de errores
      errorChannelId: this.hardcodedChannelId,
      errorChannelStatus: this.hardcodedChannelId ? 'Configurado' : 'No configurado'
    };
  }
}

module.exports = ErrorLogger; 