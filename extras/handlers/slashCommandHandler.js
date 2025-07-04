const validations = require('./validations');

/**
 * Maneja la ejecución de comandos slash con todas las validaciones
 */
async function handleSlashCommand(interaction) {
  try {
    console.log(`🎯 [SLASH-HANDLER] Procesando comando: ${interaction.commandName}`);
    
    // Deferir INMEDIATAMENTE sin validaciones
    await interaction.deferReply({ ephemeral: true });
    
    // Obtener el comando primero
    const command = interaction.client.slashCommands.get(interaction.commandName);
    if (!command) {
      console.error(`❌ [SLASH-HANDLER] No se encontró el comando ${interaction.commandName}`);
      await interaction.editReply({ content: '❌ Comando no encontrado.' });
      return;
    }

    // Realizar validaciones (pasando el comando)
    const validation = await validations.validate(interaction, command);
    if (!validation.isValid) {
      console.log(`❌ [SLASH-HANDLER] Validación fallida para ${interaction.commandName}`);
      await interaction.editReply({ content: validation.errorMessage });
      return;
    }

    // Ejecutar el comando
    console.log(`✅ [SLASH-HANDLER] Ejecutando comando: ${interaction.commandName}`);
    await command.execute(interaction);
    console.log(`✅ [SLASH-HANDLER] Comando ${interaction.commandName} ejecutado exitosamente`);
    
  } catch (error) {
    console.error(`❌ [SLASH-HANDLER] Error al ejecutar el comando ${interaction.commandName}:`, error);
    
    // Registrar en el error logger si está disponible
    if (global.errorLogger) {
      global.errorLogger.logInteractionError(error, interaction);
    }
    
    // Intentar responder con el error
    try {
      await interaction.editReply({ 
        content: '❌ Hubo un error al ejecutar este comando.' 
      });
    } catch (replyError) {
      console.error(`❌ [SLASH-HANDLER] Error adicional al enviar mensaje de error:`, replyError);
    }
  }
}

module.exports = {
  handleSlashCommand
}; 