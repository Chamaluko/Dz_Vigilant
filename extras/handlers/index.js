/**
 * Índice de manejadores - Centraliza todas las funcionalidades
 * de manejo de interacciones del bot
 */

const validations = require('./validations');
const { handleButtonInteraction, buttonHandlers } = require('./buttonHandlers');
const { handleSlashCommand } = require('./slashCommandHandler');
const { handleModalInteraction, modalHandlers } = require('./modalHandlers');

/**
 * Manejador principal de interacciones
 * Recibe cualquier tipo de interacción y la enruta al manejador apropiado
 */
async function handleInteraction(interaction) {
  try {
    console.log(`🔄 [INTERACTION-ROUTER] Tipo de interacción: ${interaction.type} | Usuario: ${interaction.user.username}`);
    
    // Comandos slash
    if (interaction.isChatInputCommand()) {
      console.log(`🎯 [INTERACTION-ROUTER] Enrutando comando slash: ${interaction.commandName}`);
      await handleSlashCommand(interaction);
    }
    // Botones
    else if (interaction.isButton()) {
      // Botones internos del comando setup (no deben ser manejados por el router)
      const internalSetupButtons = ['prev', 'next', 'create', 'skip'];
      const isSetupButton = interaction.customId.startsWith('channel_') || internalSetupButtons.includes(interaction.customId);
      
      if (isSetupButton) {
        console.log(`🔘 [INTERACTION-ROUTER] Botón interno del setup detectado: ${interaction.customId} - Ignorando router`);
        return; // No procesar, dejar que el comando setup lo maneje
      }
      
      console.log(`🔘 [INTERACTION-ROUTER] Enrutando botón: ${interaction.customId}`);
      await handleButtonInteraction(interaction);
    }
    // Menús de selección
    else if (interaction.isStringSelectMenu()) {
      // Select menus internos del comando setup (no deben ser manejados por el router)
      const internalSetupSelects = ['role_', 'admin_channel_'];
      const isSetupSelect = internalSetupSelects.some(prefix => interaction.customId.startsWith(prefix));
      
      if (isSetupSelect) {
        console.log(`📋 [INTERACTION-ROUTER] Select menu interno del setup detectado: ${interaction.customId} - Ignorando router`);
        return; // No procesar, dejar que el comando setup lo maneje
      }
      
      console.log(`📋 [INTERACTION-ROUTER] Enrutando select menu: ${interaction.customId}`);
      await handleButtonInteraction(interaction); // Los select menus se manejan igual que los botones
    }
    // Modales
    else if (interaction.isModalSubmit()) {
      console.log(`🖼️ [INTERACTION-ROUTER] Enrutando modal: ${interaction.customId}`);
      await handleModalInteraction(interaction);
    }
    // Tipo de interacción no reconocido
    else {
      console.warn(`⚠️ [INTERACTION-ROUTER] Tipo de interacción no reconocido: ${interaction.type}`);
    }
    
  } catch (error) {
    console.error('❌ [INTERACTION-ROUTER] Error en el manejador principal de interacciones:', error);
    
    // Registrar en el error logger si está disponible
    if (global.errorLogger) {
      global.errorLogger.logInteractionError(error, interaction);
    }
    
    // Intentar responder si es posible
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: '❌ Ocurrió un error inesperado. Por favor, contacta a un administrador.', 
          flags: require('discord.js').MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      console.error('❌ [INTERACTION-ROUTER] Error adicional al intentar responder:', replyError);
    }
  }
}

// Exportar todo lo necesario
module.exports = {
  // Manejador principal
  handleInteraction,
  
  // Manejadores específicos (por si necesitas usarlos directamente)
  handleSlashCommand,
  handleButtonInteraction,
  handleModalInteraction,
  
  // Sistema de validaciones
  validations,
  
  // Manejadores individuales (por si necesitas agregar más)
  buttonHandlers,
  modalHandlers
}; 