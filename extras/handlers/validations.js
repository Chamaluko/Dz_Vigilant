const configManager = require('../tools/configManager');
const { RoleBot, ChannelBot, StaticMessage } = require('../database/models');
const { MessageFlags } = require('discord.js');

/**
 * Sistema de validaciones para comandos slash y botones administrativos
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
    console.log(`🔍 [VALIDATION] Verificando servidor con GuildId: "${interaction.guildId}"`);
    const isConfigured = await configManager.isConfigured(interaction.guildId);
    console.log(`🔍 [VALIDATION] ConfigManager devolvió: ${isConfigured} (tipo: ${typeof isConfigured})`);
    
    if (!isConfigured) {
      console.log(`❌ [VALIDATION] Servidor NO configurado - enviando error`);
      return {
        isValid: false,
        errorMessage: '❌ Este servidor aún no ha sido configurado. Por favor, un administrador debe ejecutar el comando `/setup` primero.'
      };
    }
    
    console.log(`✅ [VALIDATION] Servidor SÍ configurado - continuando`);
    return { isValid: true };
  },

  /**
   * Verifica las restricciones de roles e IDs del comando
   */
  validateRestrictions: async (interaction, command) => {
    const restrictions = command.declareModule?.restriction;
    
    // Si no hay restricciones definidas, permitir acceso
    if (!restrictions || (!restrictions.roles?.length && !restrictions.ids?.length)) {
      console.log(`✅ [RESTRICTION] Sin restricciones para ${interaction.commandName}`);
      return { isValid: true };
    }

    const userId = interaction.user.id;
    const member = interaction.member;
    
    console.log(`🔍 [RESTRICTION] Validando restricciones para ${interaction.commandName}:`, restrictions);

    // Verificar si el usuario está en la lista de IDs permitidos
    if (restrictions.ids?.length > 0 && restrictions.ids.includes(userId)) {
      console.log(`✅ [RESTRICTION] Usuario ${userId} permitido por ID específico`);
      return { isValid: true };
    }

    // Verificar si el usuario tiene alguno de los roles permitidos
    if (restrictions.roles?.length > 0) {
      for (const roleAlias of restrictions.roles) {
        try {
          const roleBot = await RoleBot.findByAlias(roleAlias);
          if (roleBot && !roleBot.isSkipped() && member.roles.cache.has(roleBot.id)) {
            console.log(`✅ [RESTRICTION] Usuario tiene rol ${roleAlias} (${roleBot.id})`);
            return { isValid: true };
          }
        } catch (error) {
          console.error(`❌ [RESTRICTION] Error verificando rol ${roleAlias}:`, error);
        }
      }
    }

    // Si llegamos aquí, el usuario no cumple ninguna restricción
    const restrictionDetails = [];
    if (restrictions.roles?.length > 0) {
      restrictionDetails.push(`roles: ${restrictions.roles.join(', ')}`);
    }
    if (restrictions.ids?.length > 0) {
      restrictionDetails.push(`IDs específicos`);
    }

    console.log(`❌ [RESTRICTION] Usuario ${userId} NO tiene permisos para ${interaction.commandName}`);
    return {
      isValid: false,
      errorMessage: `❌ No tienes permisos para usar este comando.\n🔒 **Acceso restringido a:** ${restrictionDetails.join(' o ')}`
    };
  },

  /**
   * Verifica si el usuario tiene permisos de staff
   */
  validateStaffPermissions: async (interaction) => {
    const isStaff = await (async () => {
      for (const roleAlias of ['dueño', 'admin', 'mod']) {
        const role = await RoleBot.findByAlias(roleAlias);
        if (role && !role.isSkipped() && interaction.member.roles.cache.has(role.id)) {
          return true;
        }
      }
      return false;
    })();

    if (!isStaff) {
      return {
        isValid: false,
        errorMessage: '❌ Solo el staff puede usar este panel.'
      };
    }

    return { isValid: true };
  },

  /**
   * Mapeo de customIds de botones a sus mensajes estáticos correspondientes
   */
  getButtonMessageMapping: () => {
    return {
      // Botones de donaciones - pueden funcionar en jefatura O admin_donaciones
      'admin_donations_stats_button': ['admin_donaciones', 'jefatura_panel'],
      'admin_donations_recent_button': ['admin_donaciones', 'jefatura_panel'], 
      'admin_donations_pending_button': ['admin_donaciones', 'jefatura_panel'],
      'admin_donations_search_button': ['admin_donaciones', 'jefatura_panel'],
      
      // Botones de tickets - pueden funcionar en jefatura O admin_tickets
      'admin_tickets_stats_button': ['admin_tickets', 'jefatura_panel'],
      'admin_tickets_active_button': ['admin_tickets', 'jefatura_panel'],
      'admin_tickets_manage_button': ['admin_tickets', 'jefatura_panel'],
      'admin_tickets_search_button': ['admin_tickets', 'jefatura_panel'],
      
      // Select menus de gestión de tickets - pueden funcionar en jefatura O admin_tickets
      'admin_tickets_manage_select': ['admin_tickets', 'jefatura_panel'],
      'admin_tickets_status_filter': ['admin_tickets', 'jefatura_panel'],
      'admin_tickets_type_filter': ['admin_tickets', 'jefatura_panel'],
      'admin_tickets_priority_filter': ['admin_tickets', 'jefatura_panel'],
      
      // Modales de búsqueda - pueden funcionar en jefatura O canales específicos  
      'admin_donations_search_modal': ['admin_donaciones', 'jefatura_panel'],
      'admin_tickets_search_modal': ['admin_tickets', 'jefatura_panel'],
      
      // Botón de reapertura manual - puede funcionar en jefatura O admin_donaciones
      'reopen_donation_channel': ['admin_donaciones', 'jefatura_panel']
    };
  },

  /**
   * Valida que una interacción de botón/modal administrativo esté en el canal correcto
   */
  validateAdministrativeChannel: async (interaction, customId) => {
    const buttonMapping = validations.getButtonMessageMapping();
    const messageAliases = buttonMapping[customId];
    
    if (!messageAliases) {
      // Si no está en el mapeo, asumir que no es un botón administrativo
      return { isValid: true };
    }

    // Convertir a array si es string único
    const aliasArray = Array.isArray(messageAliases) ? messageAliases : [messageAliases];
    
    let validChannels = [];
    let channelNames = [];

    // Obtener todos los canales válidos para este botón
    for (const alias of aliasArray) {
      const staticMessage = await StaticMessage.findByAlias(alias);
      if (staticMessage) {
        validChannels.push(staticMessage.channel_id);
        
        try {
          const channel = await interaction.client.channels.fetch(staticMessage.channel_id);
          if (channel) {
            channelNames.push(`#${channel.name}`);
          }
        } catch (error) {
          console.warn(`Canal ${staticMessage.channel_id} no encontrado para mensaje ${alias}`);
        }
      }
    }

    // Verificar si estamos en alguno de los canales válidos
    const isValidChannel = validChannels.includes(interaction.channel.id);
    
    if (!isValidChannel) {
      const channelText = channelNames.length > 1 
        ? `los canales ${channelNames.join(' o ')}`
        : channelNames.length === 1 
          ? `el canal ${channelNames[0]}`
          : 'el canal administrativo correspondiente';
          
      return {
        isValid: false,
        errorMessage: `❌ Este panel solo funciona en ${channelText}.`
      };
    }

    return { isValid: true };
  },

  /**
   * Validación completa para botones y modales administrativos
   */
  validateAdministrativeInteraction: async (interaction, customId) => {
    console.log(`🔐 [VALIDATION] Validando interacción administrativa: ${customId} en canal: ${interaction.channel.name}`);
    
    // 1. Validar canal
    const channelValidation = await validations.validateAdministrativeChannel(interaction, customId);
    if (!channelValidation.isValid) {
      return channelValidation;
    }
    
    // 2. Validar permisos de staff
    const staffValidation = await validations.validateStaffPermissions(interaction);
    if (!staffValidation.isValid) {
      return staffValidation;
    }
    
    console.log(`✅ [VALIDATION] Interacción administrativa válida para ${customId}`);
    return { isValid: true };
  },

  /**
   * Ejecuta todas las validaciones necesarias para comandos slash
   */
  validate: async (interaction, command) => {
    console.log(`🎯 [VALIDATION] Validando comando: ${interaction.commandName} en guild: ${interaction.guildId}`);
    
    // 1. Setup siempre es válido (salta todas las validaciones)
    if (validations.isSetupCommand(interaction)) {
      console.log("✅ [VALIDATION] PASÓ VALIDACIÓN Y VA A EJECUTAR COMANDO (setup)");
      return { isValid: true };
    }

    // 2. Verificar configuración del servidor
    console.log("🔍 [VALIDATION] Verificando configuración del servidor...");
    const serverConfig = await validations.isServerConfigured(interaction);
    if (!serverConfig.isValid) {
      console.log("❌ [VALIDATION] NO PASÓ VALIDACIÓN Y NO VA A EJECUTAR COMANDO (servidor no configurado)");
      return serverConfig;
    }

    // 3. Verificar restricciones del comando
    console.log("🔍 [VALIDATION] Verificando restricciones del comando...");
    const restrictionValidation = await validations.validateRestrictions(interaction, command);
    if (!restrictionValidation.isValid) {
      console.log("❌ [VALIDATION] NO PASÓ VALIDACIÓN Y NO VA A EJECUTAR COMANDO (restricciones no cumplidas)");
      return restrictionValidation;
    }

    // Si llegamos aquí, todas las validaciones pasaron
    console.log("✅ [VALIDATION] PASÓ VALIDACIÓN Y VA A EJECUTAR COMANDO");
    return { isValid: true };
  }
};

module.exports = validations; 