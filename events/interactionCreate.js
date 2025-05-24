const { Events, InteractionType } = require('discord.js');
const configManager = require('../extras/tools/configManager');
const db = require('../extras/database/indexDB');

/**
 * Sistema de validaciones para comandos slash
 */
const validations = {
  /**
   * Verifica si el comando es setup (siempre válido)
   */
  isSetupCommand: (interaction) => {
    return interaction.commandName === 'setup';
  },

  /**
   * Verifica si el servidor está configurado
   */
  isServerConfigured: async (interaction) => {
    const isConfigured = await configManager.isConfigured(interaction.guildId);
    if (!isConfigured) {
      return {
        isValid: false,
        errorMessage: '❌ Este servidor aún no ha sido configurado. Por favor, un administrador debe ejecutar el comando `/setup` primero.'
      };
    }
    return { isValid: true };
  },

  /**
   * Ejecuta todas las validaciones necesarias
   */
  validate: async (interaction) => {
    // 1. Setup siempre es válido
    if (validations.isSetupCommand(interaction)) {
      console.log("PASÓ VALIDACIÓN Y VA A EJECUTAR COMANDO (setup)");
      return { isValid: true };
    }

    // 2. Verificar configuración del servidor
    const serverConfig = await validations.isServerConfigured(interaction);
    if (!serverConfig.isValid) {
      console.log("NO PASÓ VALIDACIÓN Y NO VA A EJECUTAR COMANDO (servidor no configurado)");
      return serverConfig;
    }

    // Aquí puedes agregar más validaciones según necesites
    // Por ejemplo:
    // - Verificar permisos
    // - Verificar roles
    // - Verificar límites de uso
    // - etc.

    // Si llegamos aquí, todas las validaciones pasaron
    console.log("PASÓ VALIDACIÓN Y VA A EJECUTAR COMANDO");
    return { isValid: true };
  }
};

/**
 * Este evento se dispara cada vez que un usuario interactúa con un comando slash.
 * Su propósito principal es:
 * 1. Verificar y validar la interacción
 * 2. Diferir la respuesta según el tipo de comando
 * 3. Realizar validaciones necesarias
 * 4. Ejecutar el comando solo si todas las validaciones pasan
 */
module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    try {
      // Manejar comandos slash
      if (interaction.isChatInputCommand()) {
        // Validar antes de ejecutar cualquier comando
        const validation = await validations.validate(interaction);
        if (!validation.isValid) {
          await interaction.reply({ content: validation.errorMessage, ephemeral: true });
          return;
        }

        // Deferir la respuesta para todos los comandos
        await interaction.deferReply({ ephemeral: true });

        const command = interaction.client.slashCommands.get(interaction.commandName);
        if (!command) {
          console.error(`No se encontró el comando ${interaction.commandName}`);
          await interaction.editReply({ content: '❌ Comando no encontrado.' });
          return;
        }

        try {
          await command.execute(interaction);
        } catch (error) {
          console.error(`Error al ejecutar el comando ${interaction.commandName}:`, error);
          await interaction.editReply({ content: '❌ Hubo un error al ejecutar este comando.' });
        }
      }
      // Manejar botones
      else if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
          try {
            // Obtener el rol de verificación
            const verifyRole = await db.get('SELECT * FROM rolesBot WHERE alias = ?', ['verified']);
            if (!verifyRole) {
              await interaction.reply({ content: '❌ No se encontró el rol de verificación. Por favor, contacta a un administrador.', ephemeral: true });
              return;
            }

            // Verificar si el usuario ya tiene el rol
            const member = interaction.member;
            if (member.roles.cache.has(verifyRole.id)) {
              await interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
              return;
            }

            // Agregar el rol
            await member.roles.add(verifyRole.id);
            await interaction.reply({ content: '✅ ¡Has sido verificado exitosamente!', ephemeral: true });
          } catch (error) {
            console.error('Error al verificar usuario:', error);
            await interaction.reply({ content: '❌ Hubo un error al verificar tu cuenta. Por favor, contacta a un administrador.', ephemeral: true });
          }
        }
      }
    } catch (error) {
      console.error('Error en el manejador de interacciones:', error);
    }
  },
};
