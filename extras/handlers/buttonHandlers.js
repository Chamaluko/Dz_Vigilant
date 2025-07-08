const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { RoleBot, DonationRequest, UserProfile, ChannelBot, CompletedDonation, Ticket, Giveaway, Prize } = require('../database/models');
const { donationSettings, rolesBot } = require('../../config/defaults.json');
const validations = require('./validations');

const staffRoles = [rolesBot.dueño.alias, rolesBot.admin.alias, rolesBot.mod.alias];

/**
 * Función para crear o actualizar el mensaje administrativo de un usuario
 */
async function updateAdminUserMessage(interaction, userProfile, member) {
  try {
    // Buscar el canal de usuarios administrativo
    const usersChannel = await ChannelBot.findByAlias('users');
    if (!usersChannel || usersChannel.isSkipped()) {
      console.log('⚠️ [ADMIN-MSG] Canal de usuarios administrativo no configurado');
      return;
    }

    const channel = interaction.guild.channels.cache.get(usersChannel.id);
    if (!channel) {
      console.log('❌ [ADMIN-MSG] No se pudo encontrar el canal de usuarios administrativo');
      return;
    }

    // Obtener datos adicionales del usuario
    const donations = await DonationRequest.findByMemberId(member.id);
    const totalDonations = donations.length;
    const approvedDonations = donations.filter(d => d.status === 'approved').length;
    const pendingDonations = donations.filter(d => d.status === 'pending').length;
    
    // Calcular total donado
    let totalAmountDonated = 0;
    const approvedDonationsList = donations.filter(d => d.status === 'approved');
    for (const donation of approvedDonationsList) {
      const amount = parseFloat(donation.amount.replace(/[^0-9.]/g, '')) || 0;
      totalAmountDonated += amount;
    }

    // Obtener rol más alto
    const highestRole = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .first();

    // Calcular tiempo en servidor
    const joinedDate = member.joinedAt;
    const now = new Date();
    const daysInServer = Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));

    // Crear embed administrativo completo
    const adminEmbed = new EmbedBuilder()
      .setTitle(`👤 ${member.displayName} (${member.user.username})`)
      .setDescription(`**ID:** ${member.id}\n**💰 ${userProfile.dz_coins} DZ Coins**`)
      .setColor(0xFF6B6B)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: '📊 Información Básica',
          value: `**Rol principal:** ${highestRole ? highestRole.name : 'Sin rol'}\n**Días en servidor:** ${daysInServer}\n**Se unió:** <t:${Math.floor(joinedDate.getTime() / 1000)}:D>\n**Última actividad:** <t:${Math.floor(userProfile.last_active.getTime() / 1000)}:R>`,
          inline: true
        },
        {
          name: '💰 Actividad de Donaciones',
          value: `**Total donado:** $${totalAmountDonated.toFixed(2)}\n**Donaciones:** ${totalDonations} (✅${approvedDonations} ⏳${pendingDonations})\n**DZ Coins:** ${userProfile.dz_coins}`,
          inline: true
        },
        {
          name: '⚙️ Estado del Perfil',
          value: `**Tema:** ${userProfile.profile_theme}\n**Días activos:** ${userProfile.days_active}\n**Nivel:** ${userProfile.level}`,
          inline: false
        }
      )
      .setFooter({ text: `Actualizado • Usuario: ${member.user.username}` })
      .setTimestamp();

    // Si ya existe un mensaje, actualizarlo
    if (userProfile.admin_message_id) {
      try {
        const existingMessage = await channel.messages.fetch(userProfile.admin_message_id);
        await existingMessage.edit({ embeds: [adminEmbed] });
        console.log(`🔄 [ADMIN-MSG] Mensaje administrativo actualizado para ${member.user.username}`);
        return;
      } catch (error) {
        console.log(`⚠️ [ADMIN-MSG] Mensaje anterior no encontrado para ${member.user.username}, creando nuevo`);
        userProfile.admin_message_id = null;
      }
    }

    // Crear nuevo mensaje si no existe
    const newMessage = await channel.send({ embeds: [adminEmbed] });
    userProfile.admin_message_id = newMessage.id;
    await userProfile.save();
    
    console.log(`✅ [ADMIN-MSG] Nuevo mensaje administrativo creado para ${member.user.username}`);

  } catch (error) {
    console.error('❌ [ADMIN-MSG] Error al actualizar mensaje administrativo:', error);
  }
}

/**
 * Manejadores de botones organizados por funcionalidad
 */
const buttonHandlers = {
  
  /**
   * Maneja el botón de verificación
   */
  verify_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando verificación para usuario ${interaction.user.username}`);
      
      // Obtener el rol de verificación usando Mongoose
      const verifyRole = await RoleBot.findByAlias('verified');
      if (!verifyRole || verifyRole.isSkipped()) {
        await interaction.reply({ 
          content: '❌ No se encontró el rol de verificación. Por favor, contacta a un administrador.', 
          ephemeral: true 
        });
        return;
      }

      // Verificar si el usuario ya tiene el rol
      const member = interaction.member;
      if (member.roles.cache.has(verifyRole.id)) {
        await interaction.reply({ 
          content: '✅ Ya estás verificado.', 
          ephemeral: true 
        });
        return;
      }

      // Agregar el rol
      await member.roles.add(verifyRole.id);
      await interaction.reply({ 
        content: '✅ ¡Has sido verificado exitosamente!', 
        ephemeral: true 
      });
      
      console.log(`✅ [BUTTON] Usuario ${interaction.user.username} verificado exitosamente`);
      
    } catch (error) {
      console.error('❌ [BUTTON] Error al verificar usuario:', error);
      await interaction.reply({ 
        content: '❌ Hubo un error al verificar tu cuenta. Por favor, contacta a un administrador.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón de crear ticket
   */
  create_ticket_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Creando ticket para usuario ${interaction.user.username}`);
      
      // Generar identificador único para el ticket
      const ticketId = Ticket.generateId();
      console.log(`🔘 [BUTTON] Ticket ID generado: ${ticketId}`);
      const ticketIdentifier = ticketId.split('_').slice(-2).join('_'); // Extraer timestamp_random
      console.log(`🔘 [BUTTON] Ticket Identifier generado: ${ticketIdentifier}`);
      // Crear el ticket privado con identificador único
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}-${ticketIdentifier}`,
        type: 0, // GUILD_TEXT
        parent: null, // Puedes configurar una categoría específica para tickets
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel'], // Denegar ver canal a @everyone
          },
          {
            id: interaction.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'], // SOLO el usuario puede escribir
          },
          // Roles de staff pueden VER pero NO escribir (hasta que presionen "Manage")
          ...(await Promise.all(staffRoles.map(async (roleAlias) => {
            const role = await RoleBot.findByAlias(roleAlias);
            return role && !role.isSkipped() ? {
              id: role.id,
              allow: ['ViewChannel', 'ReadMessageHistory'], // Solo VER
              deny: ['SendMessages'] // NO escribir
            } : null;
          }))).filter(Boolean)
        ],
      });

      // Crear mensaje inicial del ticket
      const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket Creado')
        .setDescription(`¡Hola ${interaction.user}!\n\nHas creado un ticket exitosamente. Un miembro del staff te atenderá pronto.\n\n**Por favor describe tu problema o pregunta con detalle.**\n Cuando se resuelva tu caso, por favor cierra tu mismo el Ticket usando el boton **Cerrar Ticket**.`)
        .setColor(0x3498DB)
        .setTimestamp();

      const ticketButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('manage_ticket_button')
            .setLabel('Manage')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👨‍💼'),
          new ButtonBuilder()
            .setCustomId('close_ticket_button')
            .setLabel('Cerrar Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
        );

      await ticketChannel.send({ 
        content: `${interaction.user}`, 
        embeds: [embed], 
        components: [ticketButtons] 
      });

      // **NUEVO: Guardar ticket en la base de datos**
      try {
        const ticket = new Ticket({
          id: ticketId, // Usar el ID ya generado
          creator_id: interaction.user.id,
          creator_username: interaction.user.username,
          channel_id: ticketChannel.id,
          channel_name: ticketChannel.name,
          title: 'Ticket de Soporte General',
          description: 'Ticket creado desde el panel de tickets'
        });

        await ticket.save();
        console.log(`💾 [DATABASE] Ticket guardado en BD: ${ticket.id} - Canal: ${ticketChannel.name}`);
      } catch (dbError) {
        console.error('❌ [DATABASE] Error al guardar ticket en BD:', dbError);
        // No interrumpir el flujo, el ticket ya se creó
      }

      await interaction.reply({ 
        content: `✅ ¡Ticket creado! Puedes encontrarlo aquí: ${ticketChannel}`, 
        ephemeral: true 
      });
      
      console.log(`✅ [BUTTON] Ticket creado exitosamente para ${interaction.user.username}: ${ticketChannel.name}`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al crear ticket:', error);
      await interaction.reply({ 
        content: '❌ Hubo un error al crear el ticket. Por favor, contacta a un administrador.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón de gestionar ticket (solo para staff)
   */
  manage_ticket_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando asignación de ticket por ${interaction.user.username}`);
      
      // Verificar que el usuario sea staff
      const isStaff = await (async () => {
        for (const roleAlias of staffRoles) {
          const role = await RoleBot.findByAlias(roleAlias);
          if (role && !role.isSkipped() && interaction.member.roles.cache.has(role.id)) {
            return { alias: roleAlias, role };
          }
        }
        return false;
      })();

      if (!isStaff) {
        await interaction.reply({ 
          content: '❌ Solo los miembros del staff (Admin/Moderación) pueden gestionar tickets.', 
          ephemeral: true 
        });
        return;
      }

      // Buscar el ticket en la base de datos
      const ticket = await Ticket.findByChannelId(interaction.channel.id);
      if (!ticket) {
        await interaction.reply({ 
          content: '❌ No se encontró este ticket en la base de datos.', 
          ephemeral: true 
        });
        return;
      }
      
      // Verificar si ya está asignado
      if (ticket.assigned_to && ticket.assigned_to !== interaction.user.id) {
        await interaction.reply({ 
          content: `❌ Este ticket ya está asignado a **${ticket.assigned_to_username}**.\n\nSolo el staff asignado puede gestionar este ticket.`, 
          ephemeral: true 
        });
        return;
      }

      // **ASIGNAR EL TICKET AL STAFF**
      ticket.assignTo(interaction.user.id, interaction.user.username);
      await ticket.save();
      console.log(`👨‍💼 [TICKET] Ticket ${ticket.id} asignado a ${interaction.user.username}`);

      // **SOLO PERMITIR ESCRITURA AL STAFF ASIGNADO (usuario sigue pudiendo escribir)**
      
      // PASO 1: Denegar escritura a todos los roles de staff
      await Promise.all(staffRoles.map(async (roleAlias) => {
        const role = await RoleBot.findByAlias(roleAlias);
        if (role && !role.isSkipped()) {
          await interaction.channel.permissionOverwrites.edit(role.id, {
            ViewChannel: true,
            SendMessages: false,
            ReadMessageHistory: true,
            ManageMessages: false
          });
        }
      }));

      // PASO 2: Permitir escritura SOLO al staff asignado
      await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true
      });

      // Respuesta silenciosa
      await interaction.deferUpdate();

    } catch (error) {
      console.error('❌ [BUTTON] Error al asignar ticket:', error);
      await interaction.reply({ 
        content: '❌ Hubo un error al asignar el ticket.', 
        ephemeral: true 
      });
    }
  },



  /**
   * Maneja el botón de cerrar ticket
   */
  close_ticket_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando cierre de ticket por ${interaction.user.username}`);
      
      // **DEFERRED AL PRINCIPIO - La interacción puede tardar**
      await interaction.deferUpdate();
      
      const isDonationTicket = interaction.channel.name.startsWith('donation-');
      
      // Verificar que el usuario sea el creador del ticket o tenga permisos de staff
      const isStaff = await (async () => {
        for (const roleAlias of staffRoles) {
          const role = await RoleBot.findByAlias(roleAlias);
          if (role && !role.isSkipped() && interaction.member.roles.cache.has(role.id)) {
            return true;
          }
        }
        return false;
      })();

      let isTicketOwner = false;
      let ticketCreatorId = null;
      let staffMemberWhoProcessed = null;

      if (isDonationTicket) {
        // Para tickets de donación, verificar ownership desde la BD
        const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
        if (donationRequest) {
          isTicketOwner = donationRequest.member_id === interaction.user.id;
          ticketCreatorId = donationRequest.member_id;
          // Determinar quien procesó el ticket (quien lo está cerrando si es staff)
          if (isStaff) {
            staffMemberWhoProcessed = {
              id: interaction.user.id,
              username: interaction.user.username
            };
          }
        }
      } else {
        isTicketOwner = interaction.channel.name.startsWith(`ticket-${interaction.user.username}-`);
      }

      if (!isStaff && !isTicketOwner) {
        await interaction.followUp({ 
          content: '❌ Solo el creador del ticket o un miembro del staff puede cerrarlo.',
          ephemeral: true
        });
        return;
      }

      // **GUARDAR CONVERSACIÓN ANTES DE CERRAR**
      try {
        // Para tickets de donación, guardar conversación en DonationRequest
        if (isDonationTicket) {
          const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
          if (donationRequest) {
            console.log(`💬 [BUTTON] Guardando conversación antes de cerrar ticket de donación: ${donationRequest.id}`);
            
            // Guardar conversación
            const conversationResult = await donationRequest.saveConversation(interaction.channel);
            if (conversationResult.success) {
              console.log(`✅ [BUTTON] Conversación guardada: ${conversationResult.messageCount} mensajes, ${conversationResult.attachmentCount} archivos`);
            } else {
              console.error(`❌ [BUTTON] Error al guardar conversación: ${conversationResult.error}`);
            }
            
            // Cerrar ticket
            donationRequest.close(interaction.user.id, interaction.user.username);
            await donationRequest.save();
            console.log(`💾 [DATABASE] Estado de solicitud de donación actualizado a 'closed': ${donationRequest.id}`);
          }
        }

        // Buscar el ticket en la nueva base de datos unificada
        const ticket = await Ticket.findByChannelId(interaction.channel.id);
        if (ticket) {
          // Guardar conversación en sistema unificado también
          console.log(`💬 [BUTTON] Guardando conversación en sistema unificado: ${ticket.id}`);
          const conversationResult = await ticket.saveConversation(interaction.channel);
          if (conversationResult.success) {
            console.log(`✅ [BUTTON] Conversación unificada guardada: ${conversationResult.messageCount} mensajes`);
          }
          
          ticket.updateStatus('closed', interaction.user.id, interaction.user.username, 'Ticket cerrado por el usuario');
          await ticket.save();
          console.log(`💾 [DATABASE] Ticket cerrado en BD: ${ticket.id}`);
        }
      } catch (dbError) {
        console.error('❌ [DATABASE] Error al actualizar estado en BD:', dbError);
      }

      if (isDonationTicket) {
        // **SISTEMA NUEVO PARA TICKETS DE DONACIÓN (6 horas)**
        await handleDonationTicketClosure(interaction, ticketCreatorId, staffMemberWhoProcessed);
      } else {
        // **SISTEMA ORIGINAL PARA TICKETS NORMALES (1 hora)**
        await handleRegularTicketClosure(interaction);
      }

    } catch (error) {
      console.error('❌ [BUTTON] Error al cerrar ticket:', error);
      try {
        await interaction.followUp({ 
          content: '❌ Hubo un error al cerrar el ticket.',
          ephemeral: true
        });
      } catch (followUpError) {
        console.error('❌ [BUTTON] Error al enviar mensaje de error:', followUpError);
      }
    }
  },

  /**
   * Maneja el botón de reclamar premios de donación - PASO 1: Seleccionar método de pago
   */
  create_donation_claim_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Abriendo selector de método de pago para ${interaction.user.username}`);
      
      // ELIMINADO: Validación que impedía múltiples tickets de donación
      // Los usuarios pueden tener múltiples donaciones simultáneas

      // Crear el select menu con métodos de pago desde configuración
      const paymentMethodSelect = new StringSelectMenuBuilder()
        .setCustomId('donation_payment_method_select')
        .setPlaceholder('🏦 Selecciona tu método de pago...')
        .addOptions(donationSettings.paymentMethods.map(method => ({
          label: method.label,
          description: method.description,
          value: method.value,
          emoji: method.emoji
        })));

      const row = new ActionRowBuilder().addComponents(paymentMethodSelect);

      await interaction.reply({ 
        content: '🎁 **Selecciona el método de pago que utilizaste para tu donación.**\n\n📋 **Instrucciones:**\n1. Selecciona tu método de pago del menú\n2. Completa la información en el siguiente formulario\n3. Sube tu comprobante en el ticket creado\n\n⏰ **Tiempo de Procesamiento:** Tu solicitud será revisada en menos de 48 horas.',
        components: [row], 
        flags: MessageFlags.Ephemeral
      });
      
      console.log(`✅ [BUTTON] Selector de método de pago mostrado a ${interaction.user.username}`);

      // Guardar la interaction para poder eliminar el mensaje después del modal
      global.selectMenuInteractions = global.selectMenuInteractions || new Map();
      global.selectMenuInteractions.set(interaction.user.id, interaction);
      
      console.log(`💾 [BUTTON] Interaction guardada para eliminación posterior: ${interaction.user.id}`);

      // Configurar temporizador de 5 minutos para eliminar el mensaje automáticamente
      setTimeout(async () => {
        try {
          const savedInteraction = global.selectMenuInteractions?.get(interaction.user.id);
          if (savedInteraction) {
            await savedInteraction.deleteReply();
            global.selectMenuInteractions.delete(interaction.user.id);
            console.log(`⏰ [TIMEOUT] Mensaje del select menu eliminado por timeout (5 min) para ${interaction.user.username}`);
          }
        } catch (error) {
          // Ignorar errores si el mensaje ya fue eliminado
          console.log(`⏰ [TIMEOUT] No se pudo eliminar mensaje por timeout para ${interaction.user.username}: ${error.message}`);
          // Limpiar la referencia aunque falle
          if (global.selectMenuInteractions?.has(interaction.user.id)) {
            global.selectMenuInteractions.delete(interaction.user.id);
          }
        }
      }, 300000); // 5 minutos = 300000 ms

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar selector de método de pago:', error);
      await interaction.reply({ 
        content: '❌ Hubo un error al abrir el formulario. Por favor, contacta a un administrador.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja la selección del método de pago - PASO 2: Mostrar selector de moneda
   */
  donation_payment_method_select: async (interaction) => {
    try {
      console.log(`🔘 [SELECT] Usuario ${interaction.user.username} seleccionó método de pago: ${interaction.values[0]}`);
      
      const selectedPaymentMethod = interaction.values[0];

      // Si es transferencia bancaria CLP, ir directo al modal de CLP
      if (selectedPaymentMethod === 'Transferencia Bancaria (CLP)') {
        console.log(`🔘 [SELECT] Transferencia CLP detectada, abriendo modal directo para: ${interaction.user.username}`);
        
        // Crear modal directo para CLP
        const modal = new ModalBuilder()
          .setCustomId(`donation_claim_modal_${selectedPaymentMethod}_CLP`)
          .setTitle('🎁 Donación en Pesos Chilenos');

        const amountInput = new TextInputBuilder()
          .setCustomId('donation_amount')
          .setLabel('Cantidad que donaste en CLP')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: 5000, 15000, 25000, 50000')
          .setRequired(true)
          .setMaxLength(15);

        const commentsInput = new TextInputBuilder()
          .setCustomId('donation_comments')
          .setLabel('Comentarios adicionales')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Comentarios adicionales sobre tu donación (opcional)...')
          .setRequired(false)
          .setMaxLength(500);

        const firstRow = new ActionRowBuilder().addComponents(amountInput);
        const secondRow = new ActionRowBuilder().addComponents(commentsInput);
        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
        console.log(`✅ [SELECT] Modal CLP directo mostrado a ${interaction.user.username} para transferencia bancaria`);
        return;
      }

      // Para otros métodos de pago, mostrar selector de moneda
      const currencySelect = new StringSelectMenuBuilder()
        .setCustomId(`donation_currency_select_${selectedPaymentMethod}`)
        .setPlaceholder('💱 Selecciona la moneda de tu donación...')
        .addOptions([
          {
            label: 'USD - Dólares',
            description: 'Dólares estadounidenses',
            value: 'USD',
            emoji: '💵'
          },
          {
            label: 'CLP - Pesos Chilenos',
            description: 'Pesos chilenos',
            value: 'CLP',
            emoji: '🇨🇱'
          },
          {
            label: 'Otra Moneda',
            description: 'Especificar otra moneda',
            value: 'OTHER',
            emoji: '🌍'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(currencySelect);

      await interaction.update({ 
        content: `💱 **Selecciona la Moneda de tu Donación**\n\n**Método de pago:** ${selectedPaymentMethod}\n\nAhora selecciona en qué moneda realizaste tu donación:\n\n💵 **USD** - Dólares estadounidenses\n🇨🇱 **CLP** - Pesos chilenos\n🌍 **Otra** - Otra moneda\n\n*Esto nos ayuda a procesar mejor tu donación*`, 
        components: [row]
      });
      
      console.log(`✅ [SELECT] Selector de moneda mostrado a ${interaction.user.username} para método: ${selectedPaymentMethod}`);

    } catch (error) {
      console.error('❌ [SELECT] Error al procesar selección de método de pago:', error);
      await interaction.followUp({ 
        content: '❌ Hubo un error al procesar tu selección. Por favor, intenta de nuevo.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja la selección de moneda - PASO 3: Abrir modal según la moneda
   */
  donation_currency_select: async (interaction) => {
    try {
      // Extraer método de pago y moneda del custom_id
      const customIdParts = interaction.customId.split('_');
      const paymentMethod = customIdParts.slice(3).join('_'); // Todo después de "donation_currency_select_"
      const selectedCurrency = interaction.values[0];
      
      console.log(`🔘 [SELECT] Usuario ${interaction.user.username} seleccionó moneda: ${selectedCurrency} para método: ${paymentMethod}`);

      // Crear modal según la moneda seleccionada
      const modal = new ModalBuilder()
        .setCustomId(`donation_claim_modal_${paymentMethod}_${selectedCurrency}`)
        .setTitle('🎁 Completar Reclamo de Donación');

      let amountInput, commentsInput;

      if (selectedCurrency === 'USD') {
        // Para USD: Solo pedir cantidad en USD
        amountInput = new TextInputBuilder()
          .setCustomId('donation_amount')
          .setLabel('Cantidad que donaste en USD')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: 5, 15, 25, 50')
          .setRequired(true)
          .setMaxLength(10);

      } else if (selectedCurrency === 'CLP') {
        // Para CLP: Solo pedir cantidad en CLP
        amountInput = new TextInputBuilder()
          .setCustomId('donation_amount')
          .setLabel('Cantidad que donaste en CLP')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: 5000, 15000, 25000, 50000')
          .setRequired(true)
          .setMaxLength(15);

      } else if (selectedCurrency === 'OTHER') {
        // Para OTRA: Pedir cantidad + tipo de moneda + USD aproximado
        amountInput = new TextInputBuilder()
          .setCustomId('donation_amount')
          .setLabel('Cantidad que donaste')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: 50, 100, 200')
          .setRequired(true)
          .setMaxLength(15);

        const currencyTypeInput = new TextInputBuilder()
          .setCustomId('currency_type')
          .setLabel('Tipo de moneda (opcional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: EUR, GBP, BRL, ARS, etc.')
          .setRequired(false)
          .setMaxLength(10);

        const usdApproxInput = new TextInputBuilder()
          .setCustomId('usd_approximate')
          .setLabel('Equivalente aproximado en USD (opcional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: 5, 15, 25, 50')
          .setRequired(false)
          .setMaxLength(10);

        commentsInput = new TextInputBuilder()
          .setCustomId('donation_comments')
          .setLabel('Comentarios adicionales')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Comentarios adicionales sobre tu donación (opcional)...')
          .setRequired(false)
          .setMaxLength(500);

        const firstRow = new ActionRowBuilder().addComponents(amountInput);
        const secondRow = new ActionRowBuilder().addComponents(currencyTypeInput);
        const thirdRow = new ActionRowBuilder().addComponents(usdApproxInput);
        const fourthRow = new ActionRowBuilder().addComponents(commentsInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
        
        await interaction.showModal(modal);
        console.log(`✅ [SELECT] Modal OTHER (paso 3) mostrado a ${interaction.user.username}: ${paymentMethod} - ${selectedCurrency}`);
        return;
      }

      // Para USD y CLP: Solo 2 campos
      if (!commentsInput) {
        commentsInput = new TextInputBuilder()
          .setCustomId('donation_comments')
          .setLabel('Comentarios adicionales')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Comentarios adicionales sobre tu donación (opcional)...')
          .setRequired(false)
          .setMaxLength(500);
      }

      const firstRow = new ActionRowBuilder().addComponents(amountInput);
      const secondRow = new ActionRowBuilder().addComponents(commentsInput);
      modal.addComponents(firstRow, secondRow);

      await interaction.showModal(modal);
      console.log(`✅ [SELECT] Modal ${selectedCurrency} (paso 3) mostrado a ${interaction.user.username}: ${paymentMethod} - ${selectedCurrency}`);

    } catch (error) {
      console.error('❌ [SELECT] Error al procesar selección de moneda:', error);
      await interaction.followUp({ 
        content: '❌ Hubo un error al procesar tu selección. Por favor, intenta de nuevo.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja la selección del panel de gestión de tickets
   */
  admin_tickets_manage_select: async (interaction) => {
    try {
      const selectedOption = interaction.values[0];
      console.log(`🔘 [SELECT] Gestión de tickets: ${selectedOption} por ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_manage_select');
      if (!validation.isValid) {
        await interaction.update({
          content: validation.errorMessage,
          components: [],
          embeds: []
        });
        return;
      }

      await interaction.deferUpdate();

      let embed;
      let tickets = [];

      switch (selectedOption) {
        case 'by_status':
          embed = new EmbedBuilder()
            .setTitle('📊 Seleccionar Estado')
            .setDescription('**Selecciona el estado de tickets que deseas ver:**')
            .setColor(0xE74C3C);

          const statusSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_tickets_status_filter')
            .setPlaceholder('📊 Selecciona un estado...')
            .addOptions([
              { label: '🟢 Abiertos', value: 'open', emoji: '🟢' },
              { label: '🔴 Cerrados', value: 'closed', emoji: '🔴' },
              { label: '🔄 Reabiertos', value: 'reopened', emoji: '🔄' },
              { label: '🔺 Escalados', value: 'escalated', emoji: '🔺' },
              { label: '✅ Resueltos', value: 'resolved', emoji: '✅' },
              { label: '📦 Archivados', value: 'archived', emoji: '📦' }
            ]);

          const statusRow = new ActionRowBuilder().addComponents(statusSelect);
          await interaction.editReply({ embeds: [embed], components: [statusRow] });
          break;

        case 'by_type':
          embed = new EmbedBuilder()
            .setTitle('🎫 Seleccionar Tipo')
            .setDescription('**Selecciona el tipo de tickets que deseas ver:**')
            .setColor(0xF39C12);

          const typeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_tickets_type_filter')
            .setPlaceholder('🎫 Selecciona un tipo...')
            .addOptions([
              { label: '🎫 General', value: 'general', emoji: '🎫' },
              { label: '💰 Donación', value: 'donation', emoji: '💰' },
              { label: '🛠️ Soporte', value: 'support', emoji: '🛠️' },
              { label: '🚨 Reporte', value: 'report', emoji: '🚨' },
              { label: '💡 Sugerencia', value: 'suggestion', emoji: '💡' }
            ]);

          const typeRow = new ActionRowBuilder().addComponents(typeSelect);
          await interaction.editReply({ embeds: [embed], components: [typeRow] });
          break;

        case 'by_priority':
          embed = new EmbedBuilder()
            .setTitle('🔥 Seleccionar Prioridad')
            .setDescription('**Selecciona la prioridad de tickets que deseas ver:**')
            .setColor(0x8E44AD);

          const prioritySelect = new StringSelectMenuBuilder()
            .setCustomId('admin_tickets_priority_filter')
            .setPlaceholder('🔥 Selecciona una prioridad...')
            .addOptions([
              { label: '🔻 Baja', value: 'low', emoji: '🔻' },
              { label: '⚪ Normal', value: 'normal', emoji: '⚪' },
              { label: '🔶 Alta', value: 'high', emoji: '🔶' },
              { label: '🔴 Urgente', value: 'urgent', emoji: '🔴' }
            ]);

          const priorityRow = new ActionRowBuilder().addComponents(prioritySelect);
          await interaction.editReply({ embeds: [embed], components: [priorityRow] });
          break;

        case 'assigned_to_me':
          tickets = await Ticket.findByAssignedTo(interaction.user.id).limit(10);
          
          embed = new EmbedBuilder()
            .setTitle(`👤 Mis Tickets Asignados (${tickets.length})`)
            .setColor(0x9B59B6)
            .setTimestamp();

          if (tickets.length === 0) {
            embed.setDescription('✅ No tienes tickets asignados actualmente.');
          } else {
            tickets.forEach((ticket, index) => {
              const statusEmoji = { open: '🟢', closed: '🔴', reopened: '🔄' }[ticket.status] || '❓';
              const priorityEmoji = { urgent: '🔴', high: '🔶', normal: '⚪', low: '🔻' }[ticket.priority] || '⚪';
              
              embed.addFields({
                name: `${statusEmoji} ${ticket.title || ticket.type}`,
                value: `**Usuario:** ${ticket.creator_username}\n**Prioridad:** ${priorityEmoji} ${ticket.priority}\n**Canal:** <#${ticket.channel_id}>\n**ID:** \`${ticket.id}\`\n**Creado:** <t:${Math.floor(ticket.created_at.getTime() / 1000)}:R>`,
                inline: true
              });
            });
          }

          await interaction.editReply({ embeds: [embed], components: [] });
          break;

        default:
          await interaction.editReply({ 
            content: '❌ Opción no reconocida.', 
            components: [],
            embeds: []
          });
      }

    } catch (error) {
      console.error('❌ [SELECT] Error en panel de gestión de tickets:', error);
      await interaction.editReply({ 
        content: '❌ Error al procesar la gestión de tickets.', 
        components: [],
        embeds: []
      });
    }
  },



  /**
   * Maneja el botón de aprobar donación (solo staff) - PASO 1: Pedir DZ Coins
   */
  approve_donation_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando aprobación de donación por ${interaction.user.username}`);
      
      // Verificar permisos de staff
      const isStaff = await (async () => {
        for (const roleAlias of staffRoles) {
          const role = await RoleBot.findByAlias(roleAlias);
          if (role && !role.isSkipped() && interaction.member.roles.cache.has(role.id)) {
            return true;
          }
        }
        return false;
      })();

      if (!isStaff) {
        await interaction.reply({ 
          content: '❌ Solo el staff puede aprobar donaciones.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // Obtener información del ticket desde el nombre del canal
      const ticketInfo = interaction.channel.name.match(/donation-(.+)/);
      if (!ticketInfo) {
        await interaction.reply({ 
          content: '❌ Este no parece ser un ticket de donación válido.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // Obtener información de la donación para calcular DZ Coins sugeridos
      try {
        const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
        if (donationRequest) {
          const donationAmount = parseFloat(donationRequest.amount.replace(/[^0-9.]/g, '')) || 0;
        }
      } catch (error) {
        console.error('Error al calcular coins sugeridos:', error);
      }

      // Crear modal para que el admin especifique DZ Coins y monto USD real
      const modal = new ModalBuilder()
        .setCustomId('approve_donation_coins_modal')
        .setTitle('💰 Aprobar Donación - DZ Coins y USD');

      const coinsInput = new TextInputBuilder()
        .setCustomId('dz_coins_amount')
        .setLabel('Cantidad de DZ Coins a otorgar')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 25, 75, 150, 250')
        .setRequired(true)
        .setMaxLength(10);

      const usdInput = new TextInputBuilder()
        .setCustomId('usd_amount_real')
        .setLabel('Monto real de la donación en USD')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 5, 15, 30, 50')
        .setRequired(true)
        .setMaxLength(10);

      const reasonInput = new TextInputBuilder()
        .setCustomId('approval_reason')
        .setLabel('Comentario de aprobación (opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: Donación verificada correctamente, comprobante válido...')
        .setRequired(false)
        .setMaxLength(500);

      const firstRow = new ActionRowBuilder().addComponents(coinsInput);
      const secondRow = new ActionRowBuilder().addComponents(usdInput);
      const thirdRow = new ActionRowBuilder().addComponents(reasonInput);

      modal.addComponents(firstRow, secondRow, thirdRow);

      await interaction.showModal(modal);
      console.log(`✅ [BUTTON] Modal de aprobación mostrado a ${interaction.user.username} `);

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar modal de aprobación:', error);
      await interaction.reply({ 
        content: '❌ Error al procesar la aprobación.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja el botón de rechazar donación (solo staff)
   */
  reject_donation_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando rechazo de donación por ${interaction.user.username}`);
      
      // Verificar permisos de staff
      const isStaff = await (async () => {
        for (const roleAlias of staffRoles) {
          const role = await RoleBot.findByAlias(roleAlias);
          if (role && !role.isSkipped() && interaction.member.roles.cache.has(role.id)) {
            return true;
          }
        }
        return false;
      })();

      if (!isStaff) {
        await interaction.reply({ 
          content: '❌ Solo el staff puede rechazar donaciones.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // Crear modal para razón del rechazo
      const modal = new ModalBuilder()
        .setCustomId('reject_donation_modal')
        .setTitle('❌ Rechazar Reclamo');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('Razón del rechazo')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Explica por qué se rechaza este reclamo...')
        .setRequired(true)
        .setMaxLength(500);

      const row = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      console.log(`✅ [BUTTON] Modal de rechazo mostrado por ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al rechazar donación:', error);
      await interaction.reply({ 
        content: '❌ Error al procesar el rechazo.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja el botón de reabrir ticket
   */
  reopen_ticket_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando reapertura de ticket por ${interaction.user.username}`);
      
      // Verificar que el usuario sea el creador del ticket o tenga permisos de staff
      const isStaff = await (async () => {
        for (const roleAlias of staffRoles) {
          const role = await RoleBot.findByAlias(roleAlias);
          if (role && !role.isSkipped() && interaction.member.roles.cache.has(role.id)) {
            return true;
          }
        }
        return false;
      })();

      // Para tickets de donación, verificar si es el dueño del ticket
      let isTicketOwner = false;
      if (interaction.channel.name.startsWith('donation-')) {
        // Obtener el donationRequest de la BD para verificar ownership
        try {
          const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
          isTicketOwner = donationRequest && donationRequest.member_id === interaction.member.id;
        } catch (error) {
          console.error('Error verificando ownership del ticket:', error);
          isTicketOwner = false;
        }
      } else {
        isTicketOwner = interaction.channel.name.startsWith(`ticket-${interaction.user.username}-`);
      }

      if (!isStaff && !isTicketOwner) {
        await interaction.reply({ 
          content: '❌ Solo el creador del ticket o un miembro del staff puede reabrirlo.', 
          ephemeral: true 
        });
        return;
      }

      // **NUEVO: Actualizar estado en BD - SISTEMA UNIFICADO**
      try {
        // Buscar el ticket en la nueva base de datos unificada
        const ticket = await Ticket.findByChannelId(interaction.channel.id);
        if (ticket) {
          ticket.updateStatus('reopened', interaction.user.id, interaction.user.username, 'Ticket reabierto por el usuario');
          await ticket.save();
          console.log(`💾 [DATABASE] Ticket reabierto en BD: ${ticket.id}`);
          
          // **RESTAURAR PERMISOS DE ESCRITURA AL USUARIO EN TICKETS NORMALES**
          if (isTicketOwner && ticket.creator_id && !interaction.channel.name.startsWith('donation-')) {
            await interaction.channel.permissionOverwrites.edit(ticket.creator_id, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            });
            console.log(`✅ [REGULAR] Permisos de escritura restaurados para el usuario: ${ticket.creator_id}`);
          }
        }

        // Mantener compatibilidad con tickets de donación existentes
        if (interaction.channel.name.startsWith('donation-')) {
          const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
          if (donationRequest) {
            donationRequest.reopen(interaction.member.id, interaction.user.username);
            await donationRequest.save();
            console.log(`💾 [DATABASE] Estado de solicitud de donación actualizado a 'reopened': ${donationRequest.id}`);
            
            // **RESTAURAR PERMISOS DEL USUARIO EN TICKETS DE DONACIÓN**
            if (isTicketOwner && donationRequest.member_id) {
              await interaction.channel.permissionOverwrites.edit(donationRequest.member_id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              });
              console.log(`✅ [DONATION] Permisos restaurados para el usuario: ${donationRequest.member_id}`);
            }
          }
        }
      } catch (dbError) {
        console.error('❌ [DATABASE] Error al actualizar estado en BD:', dbError);
      }

      // Crear nuevo botón de cerrar
      const closeButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket_button')
            .setLabel('Cerrar Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
        );

      await interaction.reply({ 
        content: `🔄 **Ticket reabierto exitosamente por ${interaction.user}**\n\n✅ El ticket ha sido reactivado y el temporizador de cierre ha sido cancelado.\n\n*Puedes continuar con tu consulta o solicitud.*`, 
        components: [closeButton],
        ephemeral: false 
      });
      
      console.log(`✅ [BUTTON] Ticket ${interaction.channel.name} reabierto por ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al reabrir ticket:', error);
      await interaction.reply({ 
        content: '❌ Hubo un error al reabrir el ticket.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón "Mi Perfil" 
   */
  profile_view_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando vista de perfil para ${interaction.user.username}`);
      
      const member = interaction.member;
      const user = interaction.user;
      
      // Obtener o crear perfil del usuario
      const userProfile = await UserProfile.findOrCreate(
        member.id, 
        user.username, 
        user.displayName, 
        member.joinedAt
      );
      
      // Actualizar actividad
      userProfile.updateActivity();
      await userProfile.save();

      // Actualizar mensaje administrativo
      await updateAdminUserMessage(interaction, userProfile, member);

      // Obtener rol más alto del usuario (excluyendo @everyone)
      const highestRole = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .first();

      // Calcular tiempo en el servidor
      const joinedDate = member.joinedAt;
      const now = new Date();
      const daysInServer = Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));

      // Obtener solo los roles importantes del usuario
      const importantRoles = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 3); // Solo los 3 roles más importantes

      const rolesText = importantRoles.length > 0 ? importantRoles.join(' ') : 'Sin roles especiales';

      // Crear embed de perfil BÁSICO (sin niveles, sin experiencia, sin rangos)
      const embed = new EmbedBuilder()
        .setTitle(`👤 ${user.displayName}`)
        .setDescription(`**💰 ${userProfile.dz_coins} DZ Coins disponibles**`)
        .setColor(0x9B59B6)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
          { 
            name: '👋 Información Básica', 
            value: `**Usuario:** ${user.username}\n**Se unió:** <t:${Math.floor(joinedDate.getTime() / 1000)}:D>\n**Tiempo aquí:** ${daysInServer} días`, 
            inline: true 
          },
          { 
            name: '🎭 Roles Principales', 
            value: rolesText, 
            inline: true 
          },
          { 
            name: '🪙 DZ Coins', 
            value: `${userProfile.dz_coins} DZ Coins`, 
            inline: false 
          }
        )
        .setFooter({ text: `Usuario: ${user.username}` })
        .setTimestamp();

      // Botones de navegación
      const navigationButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_donations_button')
            .setLabel('Mis Donaciones')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId('profile_prizes_button')
            .setLabel('Mis Premios')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏆'),
          new ButtonBuilder()
            .setCustomId('profile_stats_button')
            .setLabel('Estadísticas')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId('profile_config_button')
            .setLabel('Configurar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️')
        );

      // Usar reply para el primer mensaje desde el canal, update para navegación
      const isFromChannel = interaction.message && interaction.message.author.bot && interaction.message.embeds.length > 0 && interaction.message.embeds[0].title === '👤 Sistema de Perfiles';
      
      if (isFromChannel) {
        // Primer click desde el canal estático
        await interaction.reply({ 
          embeds: [embed], 
          components: [navigationButtons],
          ephemeral: true 
        });
      } else {
        // Navegación entre secciones
        await interaction.update({ 
          embeds: [embed], 
          components: [navigationButtons]
        });
      }

      console.log(`✅ [BUTTON] Perfil básico mostrado para ${interaction.user.username} - ${userProfile.dz_coins} DZ Coins`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar perfil:', error);
      await interaction.reply({ 
        content: '❌ Error al cargar tu perfil. Inténtalo de nuevo.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón "Mis Donaciones"
   */
  profile_donations_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando historial de donaciones para ${interaction.user.username}`);
      
      // Obtener perfil del usuario
      const userProfile = await UserProfile.findByMemberId(interaction.member.id);
      if (!userProfile) {
        await interaction.update({ 
          content: '❌ No se pudo encontrar tu perfil. Usa "Mi Perfil" primero para crear uno.', 
          components: [],
          embeds: []
        });
        return;
      }

      // Obtener todas las donaciones del usuario
      const donations = await DonationRequest.findByMemberId(interaction.member.id);
      
      if (donations.length === 0) {
        // Usuario sin donaciones
        const embed = new EmbedBuilder()
          .setTitle(`💰 Mis Donaciones`)
          .setDescription(`**¡Aún no tienes donaciones registradas!**\n\nPuedes hacer tu primera donación visitando el canal de donaciones.`)
          .setColor(0x00FF7F)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { 
              name: '🎁 ¿Qué obtienes al donar?', 
              value: '• DZ Coins adicionales\n• Roles especiales\n• Beneficios en el juego\n• Reconocimiento del servidor', 
              inline: false 
            }
          );

        const navigationButtons = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('profile_view_button')
              .setLabel('Mi Perfil')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('👤'),
            new ButtonBuilder()
              .setCustomId('profile_prizes_button')
              .setLabel('Mis Premios')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🏆'),
            new ButtonBuilder()
              .setCustomId('profile_stats_button')
              .setLabel('Estadísticas')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📊')
          );

        // Usar reply para el primer mensaje desde el canal, update para navegación
        const isFromChannel = interaction.message && interaction.message.author.bot && interaction.message.embeds.length > 0 && interaction.message.embeds[0].title === '👤 Sistema de Perfiles';
        
        if (isFromChannel) {
          // Primer click desde el canal estático
          await interaction.reply({ 
            embeds: [embed], 
            components: [navigationButtons],
            ephemeral: true 
          });
        } else {
          // Navegación entre secciones
          await interaction.update({ 
            embeds: [embed], 
            components: [navigationButtons]
          });
        }
        return;
      }

      // Usuario CON donaciones - mostrar SOLO información de donaciones
      const totalDonations = donations.length;
      const approvedDonations = donations.filter(d => d.status === 'approved').length;
      const pendingDonations = donations.filter(d => d.status === 'pending').length;
      const rejectedDonations = donations.filter(d => d.status === 'rejected').length;

      // Calcular total donado (solo aprobadas)
      let totalAmountDonated = 0;
      const approvedDonationsList = donations.filter(d => d.status === 'approved');
      for (const donation of approvedDonationsList) {
        const amount = parseFloat(donation.amount.replace(/[^0-9.]/g, '')) || 0;
        totalAmountDonated += amount;
      }

      // Métodos de pago más usados
      const paymentMethods = {};
      donations.forEach(donation => {
        paymentMethods[donation.payment_method] = (paymentMethods[donation.payment_method] || 0) + 1;
      });
      
      const mostUsedMethod = Object.keys(paymentMethods).length > 0 
        ? Object.entries(paymentMethods).sort(([,a], [,b]) => b - a)[0][0]
        : 'N/A';

      // Embed SOLO con información de donaciones
      const embed = new EmbedBuilder()
        .setTitle(`💰 Historial de Donaciones`)
        .setDescription(`**$${totalAmountDonated.toFixed(2)} donados en total**`)
        .setColor(0x00FF7F)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { 
            name: '📊 Resumen', 
            value: `**Total:** ${totalDonations}\n**✅ Aprobadas:** ${approvedDonations}\n**⏳ Pendientes:** ${pendingDonations}\n**❌ Rechazadas:** ${rejectedDonations}`, 
            inline: true 
          },
          { 
            name: '💳 Método Favorito', 
            value: `**${mostUsedMethod}**\n*Usado ${paymentMethods[mostUsedMethod] || 0} veces*`, 
            inline: true 
          }
        );

      // Mostrar las últimas 5 donaciones
      const recentDonations = donations.slice(0, 5);
      let donationsList = '';

      for (const donation of recentDonations) {
        const statusEmoji = {
          'pending': '⏳',
          'approved': '✅', 
          'rejected': '❌',
          'closed': '🔒',
          'reopened': '🔄'
        };

        const createdDate = new Date(donation.created_at);
        donationsList += `${statusEmoji[donation.status]} **$${donation.amount}** via ${donation.payment_method}\n`;
        donationsList += `   └ <t:${Math.floor(createdDate.getTime() / 1000)}:R>\n`;
      }

      if (donationsList) {
        embed.addFields({ 
          name: `📋 Últimas ${recentDonations.length} Donaciones`, 
          value: donationsList, 
          inline: false 
        });
      }

      embed.setFooter({ text: `${totalDonations} donaciones totales • Método favorito: ${mostUsedMethod}` });

      // Botones de navegación
      const navigationButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_view_button')
            .setLabel('Mi Perfil')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👤'),
          new ButtonBuilder()
            .setCustomId('profile_prizes_button')
            .setLabel('Mis Premios')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏆'),
          new ButtonBuilder()
            .setCustomId('profile_stats_button')
            .setLabel('Estadísticas')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        );

      // Usar reply para el primer mensaje desde el canal, update para navegación
      const isFromChannel = interaction.message && interaction.message.author.bot && interaction.message.embeds.length > 0 && interaction.message.embeds[0].title === '👤 Sistema de Perfiles';
      
      if (isFromChannel) {
        // Primer click desde el canal estático
        await interaction.reply({ 
          embeds: [embed], 
          components: [navigationButtons],
          ephemeral: true 
        });
      } else {
        // Navegación entre secciones
        await interaction.update({ 
          embeds: [embed], 
          components: [navigationButtons]
        });
      }

      console.log(`✅ [BUTTON] Historial de donaciones mostrado para ${interaction.user.username} - ${totalDonations} donaciones, $${totalAmountDonated.toFixed(2)} total`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar donaciones:', error);
      await interaction.reply({ 
        content: '❌ Error al cargar tu historial de donaciones. Inténtalo de nuevo.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón "Estadísticas"
   */
  profile_stats_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando estadísticas para ${interaction.user.username}`);
      
      const member = interaction.member;
      const user = interaction.user;
      
      // Obtener perfil del usuario
      const userProfile = await UserProfile.findByMemberId(member.id);
      if (!userProfile) {
        await interaction.update({ 
          content: '❌ No se pudo encontrar tu perfil. Usa "Mi Perfil" primero para crear uno.', 
          components: [],
          embeds: []
        });
        return;
      }
      
      // Calcular estadísticas del SERVIDOR solamente
      const joinedDate = member.joinedAt;
      const now = new Date();
      const daysInServer = Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));
      const hoursInServer = Math.floor((now - joinedDate) / (1000 * 60 * 60));

      // Estadísticas de actividad reciente (últimos 30 días)
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const donations = await DonationRequest.findByMemberId(member.id);
      const recentActivity = donations.filter(d => new Date(d.created_at) > thirtyDaysAgo).length;

             // Estadísticas específicas del servidor
       const totalMembers = member.guild.memberCount;
       const allMembers = Array.from(member.guild.members.cache.values())
         .filter(m => !m.user.bot)
         .sort((a, b) => a.joinedAt - b.joinedAt);
       const memberPosition = allMembers.findIndex(m => m.id === member.id) + 1;

      // Crear embed SOLO con estadísticas del servidor
      const embed = new EmbedBuilder()
        .setTitle(`📊 Estadísticas del Servidor`)
        .setDescription(`**Tu actividad y posición en el servidor**`)
        .setColor(0x3498DB)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { 
            name: '🏠 Integrante N°', 
            value: `**Miembro #${memberPosition}** de ${totalMembers}\n**Te uniste:** <t:${Math.floor(joinedDate.getTime() / 1000)}:R>\n**Antigüedad:** ${daysInServer} días`, 
            inline: true 
          },
          { 
            name: '📈 Actividad Reciente', 
            value: `**Últimos 30 días:**\n${recentActivity} actividades\n**Días activos:** ${userProfile.days_active}`, 
            inline: true 
          },
          { 
            name: '⏰ Tiempo Total', 
            value: `**${daysInServer}** días\n**${hoursInServer}** horas\n**${Math.floor(hoursInServer/24)}** días completos`, 
            inline: false 
          }
        )
        .setFooter({ text: `Miembro desde ${joinedDate.toLocaleDateString()}` })
        .setTimestamp();

      // Botones de navegación
      const navigationButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_view_button')
            .setLabel('Mi Perfil')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👤'),
          new ButtonBuilder()
            .setCustomId('profile_donations_button')
            .setLabel('Mis Donaciones')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId('profile_prizes_button')
            .setLabel('Mis Premios')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏆')
        );

      // Usar reply para el primer mensaje desde el canal, update para navegación
      const isFromChannel = interaction.message && interaction.message.author.bot && interaction.message.embeds.length > 0 && interaction.message.embeds[0].title === '👤 Sistema de Perfiles';
      
      if (isFromChannel) {
        // Primer click desde el canal estático
        await interaction.reply({ 
          embeds: [embed], 
          components: [navigationButtons],
          ephemeral: true 
        });
      } else {
        // Navegación entre secciones
        await interaction.update({ 
          embeds: [embed], 
          components: [navigationButtons]
        });
      }

      console.log(`✅ [BUTTON] Estadísticas del servidor mostradas para ${interaction.user.username} - Miembro #${memberPosition}, ${daysInServer} días`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar estadísticas:', error);
      await interaction.reply({ 
        content: '❌ Error al cargar tus estadísticas. Inténtalo de nuevo.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón "Configurar"
   */
  profile_config_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando configuración de perfil para ${interaction.user.username}`);
      
      // Obtener perfil del usuario
      const userProfile = await UserProfile.findByMemberId(interaction.member.id);
      if (!userProfile) {
        await interaction.update({ 
          content: '❌ No se pudo encontrar tu perfil. Usa "Mi Perfil" primero para crear uno.', 
          components: [],
          embeds: []
        });
        return;
      }

      // Crear embed de configuración SIMPLE
      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configuración de Perfil`)
        .setDescription(`**Personaliza tu experiencia**`)
        .setColor(0x95A5A6)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { 
            name: '🎨 Tema Actual', 
            value: `**${userProfile.profile_theme}**`, 
            inline: true 
          },
          { 
            name: '🎮 Nivel Actual', 
            value: `**Nivel ${userProfile.level}**\n**Experiencia:** ${userProfile.experience}`, 
            inline: true 
          },
          { 
            name: '📊 Opciones Disponibles', 
            value: '• Cambiar tema del perfil\n• Restablecer configuración\n• Configuración básica', 
            inline: false 
          }
        )
        .setFooter({ text: 'Configuración personal de tu perfil' });

      // Botones de configuración
      const configButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_view_button')
            .setLabel('Volver al Perfil')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👤'),
          new ButtonBuilder()
            .setCustomId('profile_reset_button')
            .setLabel('Restablecer')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
        );

      await interaction.update({ 
        embeds: [embed], 
        components: [configButtons]
      });

      console.log(`✅ [BUTTON] Configuración mostrada para ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar configuración:', error);
      await interaction.reply({ 
        content: '❌ Error al cargar la configuración. Inténtalo de nuevo.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón "Restablecer" (configuración)
   */
  profile_reset_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando restablecimiento de perfil para ${interaction.user.username}`);
      
      // Obtener perfil del usuario
      const userProfile = await UserProfile.findByMemberId(interaction.member.id);
      if (!userProfile) {
        await interaction.update({ 
          content: '❌ No se pudo encontrar tu perfil. Usa "Mi Perfil" primero para crear uno.', 
          components: [],
          embeds: []
        });
        return;
      }

      // Crear embed de confirmación SIMPLE
      const embed = new EmbedBuilder()
        .setTitle(`🔄 Restablecer Configuración`)
        .setDescription(`**¿Estás seguro?**\n\nEsto restablecerá:\n• Tema del perfil\n\n**Se conservará:**\n• Tus DZ Coins (${userProfile.dz_coins})\n• Tu nivel y experiencia (${userProfile.level})\n• Tu historial de donaciones`)
        .setColor(0xE74C3C)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Esta acción no se puede deshacer' });

      // Botones de confirmación
      const confirmButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_reset_confirm_button')
            .setLabel('Sí, Restablecer')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('profile_config_button')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );

      await interaction.update({ 
        embeds: [embed], 
        components: [confirmButtons]
      });

      console.log(`✅ [BUTTON] Confirmación de restablecimiento mostrada para ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar confirmación:', error);
      await interaction.reply({ 
        content: '❌ Error al procesar la confirmación. Inténtalo de nuevo.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja el botón "Confirmar Restablecimiento"
   */
  profile_reset_confirm_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Ejecutando restablecimiento para ${interaction.user.username}`);
      
      // Obtener perfil del usuario
      const userProfile = await UserProfile.findByMemberId(interaction.member.id);
      if (!userProfile) {
        await interaction.update({ 
          content: '❌ No se pudo encontrar tu perfil para restablecer.', 
          components: [],
          embeds: []
        });
        return;
      }

      // Guardar DZ Coins antes del restablecimiento
      const currentCoins = userProfile.dz_coins;

      // Restablecer configuración (conservando DZ Coins)
      userProfile.resetConfiguration();
      userProfile.dz_coins = currentCoins; // Restaurar DZ Coins
      await userProfile.save();

      // Crear embed de confirmación
      const embed = new EmbedBuilder()
        .setTitle(`✅ Configuración Restablecida`)
        .setDescription(`**¡Listo!** Tu configuración ha sido restablecida exitosamente.`)
        .setColor(0x00FF7F)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
                     { 
             name: '🔄 Cambios Aplicados', 
             value: '• Tema restablecido a por defecto\n• Configuración limpia', 
             inline: true 
           },
          { 
            name: '💰 DZ Coins', 
            value: `**${userProfile.dz_coins}** DZ Coins`, 
            inline: true 
          }
        )
        .setFooter({ text: 'Configuración restablecida exitosamente' })
        .setTimestamp();

      // Botón para volver al perfil
      const backButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_view_button')
            .setLabel('Volver al Perfil')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👤')
        );

      await interaction.update({ 
        embeds: [embed], 
        components: [backButton]
      });

      console.log(`✅ [BUTTON] Configuración restablecida para ${interaction.user.username} - ${userProfile.dz_coins} DZ Coins`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al restablecer configuración:', error);
      await interaction.update({ 
        content: '❌ Error al restablecer la configuración. Inténtalo de nuevo.', 
        components: [],
        embeds: []
      });
    }
  },

  /**
   * ========== PANEL DE ADMINISTRACIÓN JEFATURA ==========
   */

  /**
   * Mostrar estadísticas generales de donaciones (Panel Jefatura)
   */
  admin_donations_stats_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Generando estadísticas de donaciones para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_donations_stats_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Obtener estadísticas de donaciones completadas
      const completedStats = await CompletedDonation.getStats();
      const totalCompleted = await CompletedDonation.countDocuments();
      
      // Obtener estadísticas de solicitudes
      const pendingRequests = await DonationRequest.countDocuments({ status: 'pending' });
      const approvedRequests = await DonationRequest.countDocuments({ status: 'approved' });
      const rejectedRequests = await DonationRequest.countDocuments({ status: 'rejected' });

      // Donaciones por método de pago
      const paymentMethodStats = await CompletedDonation.aggregate([
        {
          $group: {
            _id: '$payment_method',
            count: { $sum: 1 },
            totalCoins: { $sum: '$dz_coins_given' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Top donadores
      const topDonors = await CompletedDonation.aggregate([
        {
          $group: {
            _id: '$member_username',
            totalDonations: { $sum: 1 },
            totalCoins: { $sum: '$dz_coins_given' }
          }
        },
        { $sort: { totalDonations: -1 } },
        { $limit: 5 }
      ]);

      const embed = new EmbedBuilder()
        .setTitle('📊 Estadísticas de Donaciones - Panel de Jefatura')
        .setColor(0x2F3136)
        .addFields(
          {
            name: '💰 Donaciones Completadas',
            value: `**Total:** ${totalCompleted}\n**DZ Coins Otorgados:** ${completedStats[0]?.totalCoinsGiven || 0}\n**Promedio por Donación:** $${(completedStats[0]?.avgDonationAmount || 0).toFixed(2)} USD`,
            inline: true
          },
          {
            name: '📋 Estados de Solicitudes',
            value: `**Pendientes:** ${pendingRequests}\n**Aprobadas:** ${approvedRequests}\n**Rechazadas:** ${rejectedRequests}`,
            inline: true
          },
          {
            name: '💳 Métodos de Pago Populares',
            value: paymentMethodStats.length > 0 ? 
              paymentMethodStats.slice(0, 3).map(method => 
                `**${method._id}:** ${method.count} (${method.totalCoins} coins)`
              ).join('\n') : 'Sin datos',
            inline: false
          },
          {
            name: '🏆 Top 5 Donadores',
            value: topDonors.length > 0 ? 
              topDonors.map((donor, index) => 
                `${index + 1}. **${donor._id}** - ${donor.totalDonations} donaciones (${donor.totalCoins} coins)`
              ).join('\n') : 'Sin datos',
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: `Solicitado por ${interaction.user.username}` });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener estadísticas:', error);
      await interaction.editReply({ content: '❌ Error al obtener estadísticas.' });
    }
  },

  /**
   * Mostrar donaciones recientes (Panel Jefatura)
   */
  admin_donations_recent_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Mostrando donaciones recientes para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_donations_recent_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const recentDonations = await CompletedDonation.find()
        .sort({ created_at: -1 })
        .limit(10);

      if (recentDonations.length === 0) {
        await interaction.editReply({ content: '📭 No hay donaciones completadas aún.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`💎 Últimas ${recentDonations.length} Donaciones Completadas`)
        .setColor(0x00FF00)
        .setTimestamp();

      recentDonations.forEach((donation, index) => {
        const date = new Date(donation.created_at).toLocaleDateString('es-ES');
        embed.addFields({
          name: `${index + 1}. ${donation.member_username}`,
          value: `**Monto:** $${donation.amount_usd} USD\n**Método:** ${donation.payment_method}\n**DZ Coins:** ${donation.dz_coins_given}\n**Aprobado por:** ${donation.approved_by_username}\n**Fecha:** ${date}`,
          inline: true
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener donaciones recientes:', error);
      await interaction.editReply({ content: '❌ Error al obtener donaciones recientes.' });
    }
  },

  /**
   * Mostrar solicitudes pendientes (Panel Jefatura)
   */
  admin_donations_pending_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Mostrando solicitudes pendientes para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_donations_pending_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const pendingRequests = await DonationRequest.find({ status: 'pending' })
        .sort({ created_at: -1 })
        .limit(15);

      if (pendingRequests.length === 0) {
        await interaction.editReply({ content: '✅ No hay solicitudes pendientes.' });
        return;
      }

      // Clasificar solicitudes por estado de canal
      const requestsWithChannels = [];
      const requestsWithoutChannels = [];

      for (const request of pendingRequests) {
        if (request.channel_id) {
          const channel = interaction.guild.channels.cache.get(request.channel_id);
          if (channel) {
            requestsWithChannels.push(request);
          } else {
            requestsWithoutChannels.push(request);
            console.log(`🔄 [ADMIN] Canal borrado detectado (sin reabrir): ${request.channel_id} - Usuario: ${request.member_username}`);
          }
        } else {
          requestsWithoutChannels.push(request);
        }
      }

      const totalPending = requestsWithChannels.length + requestsWithoutChannels.length;
      const embed = new EmbedBuilder()
        .setTitle(`⏳ Solicitudes de Donación Pendientes (${totalPending})`)
        .setColor(0xFFD700)
        .setDescription('Solicitudes que requieren revisión del staff')
        .setTimestamp();

      // Mostrar solicitudes con canales activos
      if (requestsWithChannels.length > 0) {
        let channelsList = '';
        requestsWithChannels.forEach((request, index) => {
          const date = new Date(request.created_at).toLocaleDateString('es-ES');
          const channelMention = `<#${request.channel_id}>`;
          channelsList += `**${index + 1}. ${request.member_username}**\n🔗 ${channelMention}\n💰 $${request.amount} ${request.currency || 'USD'} • ${request.payment_method}\n📅 ${date}\n\n`;
        });
        
        embed.addFields({
          name: `✅ Con Canales Activos (${requestsWithChannels.length})`,
          value: channelsList.slice(0, 1024), // Limitar a 1024 caracteres
          inline: false
        });
      }

              // Mostrar solicitudes sin canales con botones para reabrir
        if (requestsWithoutChannels.length > 0) {
          let noChannelsList = '';
          requestsWithoutChannels.forEach((request, index) => {
            const date = new Date(request.created_at).toLocaleDateString('es-ES');
            noChannelsList += `**${index + 1}. ${request.member_username}**\n💰 $${request.amount} ${request.currency || 'USD'} • ${request.payment_method}\n📅 ${date}\n🔑 ID: \`${request.id}\`\n\n`;
          });
          
          embed.addFields({
            name: `❌ Sin Canales (${requestsWithoutChannels.length})`,
            value: noChannelsList.slice(0, 1024), // Limitar a 1024 caracteres
            inline: false
          });
        }

        embed.setFooter({ text: 'Ve a los canales activos para revisar • Usa los botones para reabrir canales borrados' });

        const components = [];
        
        // Crear botones para reabrir canales (máximo 5 por fila, máximo 5 filas = 25 botones)
        if (requestsWithoutChannels.length > 0) {
          const maxButtons = Math.min(requestsWithoutChannels.length, 25);
          
          for (let i = 0; i < maxButtons; i += 5) {
            const row = new ActionRowBuilder();
            const endIndex = Math.min(i + 5, maxButtons);
            
            for (let j = i; j < endIndex; j++) {
              const request = requestsWithoutChannels[j];
              // Crear etiqueta más específica: Número + Usuario + Monto
              const buttonLabel = `${j + 1}. ${request.member_username} ($${request.amount} ${request.currency || 'USD'})`;
              
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`reopen_donation_channel_${request.id}`)
                  .setLabel(buttonLabel.slice(0, 80)) // Limitar a 80 caracteres (límite de Discord)
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('🔄')
              );
            }
            
            components.push(row);
          }
          
          if (requestsWithoutChannels.length > 25) {
            embed.addFields({
              name: '⚠️ Aviso',
              value: `Solo se muestran botones para los primeros 25 canales sin reabrir. Hay ${requestsWithoutChannels.length - 25} más que requieren atención.`,
              inline: false
            });
          }
        }

      await interaction.editReply({ embeds: [embed], components: components });

    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener solicitudes pendientes:', error);
      await interaction.editReply({ content: '❌ Error al obtener solicitudes pendientes.' });
    }
  },

  /**
   * Reabrir canal de donación específico (Manual)
   */
  reopen_donation_channel: async (interaction) => {
    try {
      // Extraer ID de la solicitud del customId
      const requestId = interaction.customId.replace('reopen_donation_channel_', '');
      console.log(`🔄 [ADMIN] Reabriendo canal manualmente para solicitud: ${requestId} por ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_donations_pending_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Buscar la solicitud en la BD
      const request = await DonationRequest.findOne({ id: requestId });
      if (!request) {
        await interaction.editReply({ content: '❌ No se encontró la solicitud de donación.' });
        return;
      }

      if (request.status !== 'pending') {
        await interaction.editReply({ content: '❌ Esta solicitud ya no está pendiente.' });
        return;
      }

      // Verificar si ya tiene un canal activo
      if (request.channel_id) {
        const existingChannel = interaction.guild.channels.cache.get(request.channel_id);
        if (existingChannel) {
          await interaction.editReply({ content: `❌ Esta solicitud ya tiene un canal activo: ${existingChannel}` });
          return;
        }
      }

            // Crear el canal nuevamente con la información de la BD
            const donationTicketChannel = await interaction.guild.channels.create({
              name: `donation-${request.id.split('_')[1]}`,
              type: 0, // GUILD_TEXT
              parent: null,
              permissionOverwrites: [
                {
                  id: interaction.guild.id,
                  deny: ['ViewChannel'], // Denegar ver canal a @everyone
                },
                {
                  id: request.member_id,
                  allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'], // Permitir al usuario
                },
                // Permitir a roles de staff
          ...(await Promise.all([rolesBot.dueño.alias].map(async (roleAlias) => {
                  const role = await RoleBot.findByAlias(roleAlias);
                  return role && !role.isSkipped() ? {
                    id: role.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                  } : null;
                }))).filter(Boolean)
              ],
            });

            // Actualizar el channel_id en la BD
            request.channel_id = donationTicketChannel.id;
            await request.save();

            // Recrear el embed con la información original
            let currencyDisplay = '';
            if (request.currency === 'USD') {
              currencyDisplay = `$${request.amount} USD`;
            } else if (request.currency === 'CLP') {
              currencyDisplay = `$${request.amount} CLP`;
            } else if (request.currency === 'OTHER') {
              if (request.currency_type && request.currency_type !== 'No especificada') {
                currencyDisplay = `${request.amount} ${request.currency_type}`;
                if (request.usd_approximate && request.usd_approximate !== 'No especificado') {
                  currencyDisplay += ` (~$${request.usd_approximate} USD)`;
                }
              } else {
                currencyDisplay = `${request.amount} (moneda no especificada)`;
              }
            } else {
              currencyDisplay = `${request.amount} ${request.currency || 'USD'}`;
            }

            const donationEmbed = new EmbedBuilder()
        .setTitle('🎁 Reclamo de Premios de Donación [CANAL REABIERTO MANUALMENTE]')
        .setDescription(`**Jugador:** <@${request.member_id}>\n**Estado:** 🟡 Pendiente de verificación\n\n🔄 **Este canal fue reabierto manualmente por el staff.**`)
              .setColor(0xFFD700)
              .addFields(
                { name: '💰 Cantidad Donada', value: currencyDisplay, inline: true },
                { name: '💱 Moneda', value: request.currency === 'OTHER' ? (request.currency_type || 'No especificada') : (request.currency || 'USD'), inline: true },
                { name: '💳 Método de Pago', value: request.payment_method, inline: true },
                { name: '🆔 Member ID', value: request.member_id, inline: true },
                { name: '📅 Fecha de Solicitud', value: new Date(request.created_at).toLocaleString('es-ES'), inline: true },
                { name: '💬 Comentarios', value: request.comments || 'Sin comentarios', inline: false }
              )
              .setTimestamp()
        .setFooter({ text: 'Sistema de Reclamos DZ Vigilant • Canal Reabierto Manualmente' });

            // Agregar campo adicional para moneda OTHER con USD aproximado
            if (request.currency === 'OTHER' && request.usd_approximate && request.usd_approximate !== 'No especificado') {
              donationEmbed.addFields({ 
                name: '💵 USD Aproximado', 
                value: `$${request.usd_approximate} USD`, 
                inline: true 
              });
            }

            // Crear botones para que el staff pueda aprobar/rechazar
            const actionButtons = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('approve_donation_button')
                  .setLabel('Aprobar Donación')
                  .setStyle(ButtonStyle.Success)
                  .setEmoji('✅'),
                new ButtonBuilder()
                  .setCustomId('reject_donation_button')
                  .setLabel('Rechazar Donación')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('❌'),
                new ButtonBuilder()
                  .setCustomId('close_ticket_button')
                  .setLabel('Cerrar Ticket')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('🗑️')
              );

      const dueñoRole = await RoleBot.findByAlias(rolesBot.dueño.alias);
            const roleMention = dueñoRole && !dueñoRole.isSkipped() ? `<@&${dueñoRole.id}>` : '';

            await donationTicketChannel.send({ 
        content: `<@${request.member_id}> | ${roleMention}\n\n🔄 **Canal Reabierto Manualmente**\nEste canal fue recreado manualmente por el staff porque el original fue borrado, pero tu solicitud sigue activa.`, 
              embeds: [donationEmbed], 
              components: [actionButtons] 
            });

      await interaction.editReply({ 
        content: `✅ Canal reabierto exitosamente para **${request.member_username}**: ${donationTicketChannel}\n\n🔄 El usuario y el staff han sido notificados.` 
      });
      
      console.log(`✅ [ADMIN] Canal reabierto manualmente: ${donationTicketChannel.name} para ${request.member_username} por ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ [ADMIN] Error al reabrir canal manualmente:', error);
      await interaction.editReply({ content: '❌ Error al reabrir el canal. Contacta a un administrador.' });
    }
  },

  /**
   * Abrir modal de búsqueda de donaciones (Panel Jefatura)
   */
  admin_donations_search_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Abriendo búsqueda de donaciones para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_donations_search_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Crear modal de búsqueda
      const modal = new ModalBuilder()
        .setCustomId('admin_donations_search_modal')
        .setTitle('🔍 Buscar Donaciones');

      const searchInput = new TextInputBuilder()
        .setCustomId('search_term')
        .setLabel('Término de búsqueda')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Usuario, monto, método de pago, etc.')
        .setRequired(true)
        .setMaxLength(50);

      const firstRow = new ActionRowBuilder().addComponents(searchInput);
      modal.addComponents(firstRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('❌ [ADMIN] Error al abrir búsqueda:', error);
      await interaction.reply({
        content: '❌ Error al abrir búsqueda.',
        flags: MessageFlags.Ephemeral
      });
    }
  },

  // ========== PANEL ADMINISTRATIVO DE TICKETS ==========

  /**
   * Ver estadísticas del sistema de tickets (Panel Jefatura)
   */
  admin_tickets_stats_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Mostrando estadísticas de tickets para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_stats_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const [stats] = await Ticket.getStats();
      
      const embed = new EmbedBuilder()
        .setTitle('📊 Estadísticas del Sistema de Tickets')
        .setColor(0x3498DB)
        .setTimestamp();

      // Estadísticas por estado
      let estadoText = '';
      const estadoEmojis = {
        open: '🟢', closed: '🔴', reopened: '🔄',
        escalated: '🔺', resolved: '✅', archived: '📦'
      };
      
      if (stats.byStatus) {
        stats.byStatus.forEach(item => {
          const emoji = estadoEmojis[item._id] || '❓';
          estadoText += `${emoji} ${item._id}: **${item.count}**\n`;
        });
      }

      // Estadísticas por tipo
      let tipoText = '';
      const tipoEmojis = {
        general: '🎫', donation: '💰', support: '🛠️',
        report: '🚨', suggestion: '💡'
      };
      
      if (stats.byType) {
        stats.byType.forEach(item => {
          const emoji = tipoEmojis[item._id] || '❓';
          tipoText += `${emoji} ${item._id}: **${item.count}**\n`;
        });
      }

      // Estadísticas por prioridad
      let prioridadText = '';
      const prioridadEmojis = {
        low: '🔻', normal: '⚪', high: '🔶', urgent: '🔴'
      };
      
      if (stats.byPriority) {
        stats.byPriority.forEach(item => {
          const emoji = prioridadEmojis[item._id] || '❓';
          prioridadText += `${emoji} ${item._id}: **${item.count}**\n`;
        });
      }

      // Estadísticas generales
      const totalStats = stats.totalStats[0] || {};
      const avgResponseTime = stats.avgResponseTime[0] ? 
        Math.round(stats.avgResponseTime[0].avgTime / (1000 * 60)) : 0; // minutos
      const avgResolutionTime = stats.avgResolutionTime[0] ? 
        Math.round(stats.avgResolutionTime[0].avgTime / (1000 * 60 * 60)) : 0; // horas

      embed.addFields(
        {
          name: '📈 Resumen General',
          value: `**Total de tickets:** ${totalStats.total || 0}\n**Mensajes totales:** ${totalStats.totalMessages || 0}\n**Satisfacción promedio:** ${totalStats.avgSatisfaction ? `${totalStats.avgSatisfaction.toFixed(1)}/5 ⭐` : 'Sin datos'}`,
          inline: false
        },
        {
          name: '📊 Por Estado',
          value: estadoText || 'Sin datos',
          inline: true
        },
        {
          name: '🎫 Por Tipo',
          value: tipoText || 'Sin datos',
          inline: true
        },
        {
          name: '🔥 Por Prioridad',
          value: prioridadText || 'Sin datos',
          inline: true
        },
        {
          name: '⏱️ Tiempos Promedio',
          value: `**Respuesta:** ${avgResponseTime}min\n**Resolución:** ${avgResolutionTime}h`,
          inline: false
        }
      );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener estadísticas de tickets:', error);
      await interaction.editReply({ content: '❌ Error al obtener estadísticas de tickets.' });
    }
  },

  /**
   * Ver tickets activos (Panel Jefatura)
   */
  admin_tickets_active_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Mostrando tickets activos para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_active_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const activeTickets = await Ticket.findActiveTickets().limit(15);

      if (activeTickets.length === 0) {
        await interaction.editReply({ content: '✅ No hay tickets activos.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🟢 Tickets Activos (${activeTickets.length})`)
        .setColor(0x2ECC71)
        .setTimestamp();

      activeTickets.forEach((ticket, index) => {
        if (index < 10) { // Máximo 10 tickets por embed
          const statusEmoji = ticket.status === 'open' ? '🟢' : 
                            ticket.status === 'reopened' ? '🔄' : '🔺';
          const priorityEmoji = ticket.priority === 'urgent' ? '🔴' : 
                              ticket.priority === 'high' ? '🔶' : 
                              ticket.priority === 'normal' ? '⚪' : '🔻';
          
          embed.addFields({
            name: `${statusEmoji} ${ticket.title || 'Sin título'}`,
            value: `**Usuario:** ${ticket.creator_username}\n**Tipo:** ${ticket.type}\n**Prioridad:** ${priorityEmoji} ${ticket.priority}\n**Canal:** <#${ticket.channel_id}>\n**ID:** \`${ticket.id}\`\n**Creado:** <t:${Math.floor(ticket.created_at.getTime() / 1000)}:R>`,
            inline: true
          });
        }
      });

      if (activeTickets.length > 10) {
        embed.setFooter({ text: `Mostrando 10 de ${activeTickets.length} tickets activos` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener tickets activos:', error);
      await interaction.editReply({ content: '❌ Error al obtener tickets activos.' });
    }
  },

  /**
   * Panel de gestión de tickets (Panel Jefatura)
   */
  admin_tickets_manage_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Abriendo panel de gestión para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_manage_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Panel de Gestión de Tickets')
        .setDescription('**Selecciona una opción para gestionar tickets:**\n\n🔹 **Por Estado** - Ver tickets por estado específico\n🔹 **Por Tipo** - Filtrar por tipo de ticket\n🔹 **Por Prioridad** - Ver tickets por nivel de prioridad\n🔹 **Asignar Staff** - Asignar tickets a miembros del staff')
        .setColor(0x9B59B6)
        .setTimestamp();

      const manageSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_tickets_manage_select')
        .setPlaceholder('⚙️ Selecciona una opción de gestión...')
        .addOptions([
          {
            label: 'Ver por Estado',
            description: 'Filtrar tickets por estado (abiertos, cerrados, etc.)',
            value: 'by_status',
            emoji: '📊'
          },
          {
            label: 'Ver por Tipo',
            description: 'Filtrar tickets por tipo (general, donación, etc.)',
            value: 'by_type', 
            emoji: '🎫'
          },
          {
            label: 'Ver por Prioridad',
            description: 'Filtrar tickets por prioridad (baja, normal, alta, urgente)',
            value: 'by_priority',
            emoji: '🔥'
          },
          {
            label: 'Tickets Asignados a Mí',
            description: 'Ver tickets que tienes asignados',
            value: 'assigned_to_me',
            emoji: '👤'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(manageSelect);

      await interaction.reply({ 
        embeds: [embed], 
        components: [row], 
        flags: MessageFlags.Ephemeral 
      });

    } catch (error) {
      console.error('❌ [ADMIN] Error al abrir panel de gestión:', error);
      await interaction.reply({
        content: '❌ Error al abrir panel de gestión.',
        flags: MessageFlags.Ephemeral
      });
    }
  },

  /**
   * Abrir modal de búsqueda de tickets (Panel Jefatura)
   */
  admin_tickets_search_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Abriendo búsqueda de tickets para ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_search_button');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Crear modal de búsqueda
      const modal = new ModalBuilder()
        .setCustomId('admin_tickets_search_modal')
        .setTitle('🔍 Buscar Tickets');

      const searchInput = new TextInputBuilder()
        .setCustomId('search_term')
        .setLabel('Término de búsqueda')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Usuario, título, descripción, ID del ticket...')
        .setRequired(true)
        .setMaxLength(50);

      const firstRow = new ActionRowBuilder().addComponents(searchInput);
      modal.addComponents(firstRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('❌ [ADMIN] Error al abrir búsqueda de tickets:', error);
      await interaction.reply({
        content: '❌ Error al abrir búsqueda.',
        flags: MessageFlags.Ephemeral
      });
    }
  },

  /**
   * Filtrar tickets por estado específico
   */
  admin_tickets_status_filter: async (interaction) => {
    try {
      const selectedStatus = interaction.values[0];
      console.log(`🔘 [SELECT] Filtrando tickets por estado: ${selectedStatus} por ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_status_filter');
      if (!validation.isValid) {
        await interaction.update({
          content: validation.errorMessage,
          components: [],
          embeds: []
        });
        return;
      }

      await interaction.deferUpdate();

      const tickets = await Ticket.find({ status: selectedStatus }).limit(15).sort({ created_at: -1 });

      const statusEmojis = { open: '🟢', closed: '🔴', reopened: '🔄', escalated: '🔺', resolved: '✅', archived: '📦' };
      const statusEmoji = statusEmojis[selectedStatus] || '❓';

      const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} Tickets con Estado: ${selectedStatus} (${tickets.length})`)
        .setColor(0xE74C3C)
        .setTimestamp();

      if (tickets.length === 0) {
        embed.setDescription(`No se encontraron tickets con estado "${selectedStatus}".`);
      } else {
        tickets.forEach((ticket, index) => {
          if (index < 10) {
            const typeEmoji = { general: '🎫', donation: '💰', support: '🛠️', report: '🚨', suggestion: '💡' }[ticket.type] || '🎫';
            const priorityEmoji = { urgent: '🔴', high: '🔶', normal: '⚪', low: '🔻' }[ticket.priority] || '⚪';
            
            embed.addFields({
              name: `${typeEmoji} ${ticket.title || ticket.type}`,
              value: `**Usuario:** ${ticket.creator_username}\n**Prioridad:** ${priorityEmoji} ${ticket.priority}\n**Canal:** <#${ticket.channel_id}>\n**ID:** \`${ticket.id}\`\n**Creado:** <t:${Math.floor(ticket.created_at.getTime() / 1000)}:R>`,
              inline: true
            });
          }
        });

        if (tickets.length > 10) {
          embed.setFooter({ text: `Mostrando 10 de ${tickets.length} tickets` });
        }
      }

      await interaction.editReply({ embeds: [embed], components: [] });

    } catch (error) {
      console.error('❌ [SELECT] Error al filtrar por estado:', error);
      await interaction.editReply({ content: '❌ Error al filtrar tickets por estado.', components: [], embeds: [] });
    }
  },

  /**
   * Filtrar tickets por tipo específico
   */
  admin_tickets_type_filter: async (interaction) => {
    try {
      const selectedType = interaction.values[0];
      console.log(`🔘 [SELECT] Filtrando tickets por tipo: ${selectedType} por ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_type_filter');
      if (!validation.isValid) {
        await interaction.update({
          content: validation.errorMessage,
          components: [],
          embeds: []
        });
        return;
      }

      await interaction.deferUpdate();

      const tickets = await Ticket.find({ type: selectedType }).limit(15).sort({ created_at: -1 });

      const typeEmojis = { general: '🎫', donation: '💰', support: '🛠️', report: '🚨', suggestion: '💡' };
      const typeEmoji = typeEmojis[selectedType] || '🎫';

      const embed = new EmbedBuilder()
        .setTitle(`${typeEmoji} Tickets de Tipo: ${selectedType} (${tickets.length})`)
        .setColor(0xF39C12)
        .setTimestamp();

      if (tickets.length === 0) {
        embed.setDescription(`No se encontraron tickets de tipo "${selectedType}".`);
      } else {
        tickets.forEach((ticket, index) => {
          if (index < 10) {
            const statusEmoji = { open: '🟢', closed: '🔴', reopened: '🔄', escalated: '🔺', resolved: '✅', archived: '📦' }[ticket.status] || '❓';
            const priorityEmoji = { urgent: '🔴', high: '🔶', normal: '⚪', low: '🔻' }[ticket.priority] || '⚪';
            
            embed.addFields({
              name: `${statusEmoji} ${ticket.title || ticket.type}`,
              value: `**Usuario:** ${ticket.creator_username}\n**Estado:** ${ticket.status}\n**Prioridad:** ${priorityEmoji} ${ticket.priority}\n**Canal:** <#${ticket.channel_id}>\n**ID:** \`${ticket.id}\`\n**Creado:** <t:${Math.floor(ticket.created_at.getTime() / 1000)}:R>`,
              inline: true
            });
          }
        });

        if (tickets.length > 10) {
          embed.setFooter({ text: `Mostrando 10 de ${tickets.length} tickets` });
        }
      }

      await interaction.editReply({ embeds: [embed], components: [] });

    } catch (error) {
      console.error('❌ [SELECT] Error al filtrar por tipo:', error);
      await interaction.editReply({ content: '❌ Error al filtrar tickets por tipo.', components: [], embeds: [] });
    }
  },

  /**
   * Filtrar tickets por prioridad específica
   */
  admin_tickets_priority_filter: async (interaction) => {
    try {
      const selectedPriority = interaction.values[0];
      console.log(`🔘 [SELECT] Filtrando tickets por prioridad: ${selectedPriority} por ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_priority_filter');
      if (!validation.isValid) {
        await interaction.update({
          content: validation.errorMessage,
          components: [],
          embeds: []
        });
        return;
      }

      await interaction.deferUpdate();

      const tickets = await Ticket.find({ priority: selectedPriority }).limit(15).sort({ created_at: -1 });

      const priorityEmojis = { urgent: '🔴', high: '🔶', normal: '⚪', low: '🔻' };
      const priorityEmoji = priorityEmojis[selectedPriority] || '⚪';

      const embed = new EmbedBuilder()
        .setTitle(`${priorityEmoji} Tickets con Prioridad: ${selectedPriority} (${tickets.length})`)
        .setColor(0x8E44AD)
        .setTimestamp();

      if (tickets.length === 0) {
        embed.setDescription(`No se encontraron tickets con prioridad "${selectedPriority}".`);
      } else {
        tickets.forEach((ticket, index) => {
          if (index < 10) {
            const statusEmoji = { open: '🟢', closed: '🔴', reopened: '🔄', escalated: '🔺', resolved: '✅', archived: '📦' }[ticket.status] || '❓';
            const typeEmoji = { general: '🎫', donation: '💰', support: '🛠️', report: '🚨', suggestion: '💡' }[ticket.type] || '🎫';
            
            embed.addFields({
              name: `${statusEmoji} ${ticket.title || ticket.type}`,
              value: `**Usuario:** ${ticket.creator_username}\n**Tipo:** ${typeEmoji} ${ticket.type}\n**Estado:** ${ticket.status}\n**Canal:** <#${ticket.channel_id}>\n**ID:** \`${ticket.id}\`\n**Creado:** <t:${Math.floor(ticket.created_at.getTime() / 1000)}:R>`,
              inline: true
            });
          }
        });

        if (tickets.length > 10) {
          embed.setFooter({ text: `Mostrando 10 de ${tickets.length} tickets` });
        }
      }

      await interaction.editReply({ embeds: [embed], components: [] });

    } catch (error) {
      console.error('❌ [SELECT] Error al filtrar por prioridad:', error);
      await interaction.editReply({ content: '❌ Error al filtrar tickets por prioridad.', components: [], embeds: [] });
    }
  },

  /**
   * Maneja el botón de eliminar canal (solo para staff)
   */
  delete_channel_button: async (interaction) => {
    try {
      console.log(`🗑️ [BUTTON] Procesando eliminación de canal por ${interaction.user.username}`);
      
      // Verificar que el usuario sea staff
      const isStaff = await (async () => {
        for (const roleAlias of staffRoles) {
          const role = await RoleBot.findByAlias(roleAlias);
          if (role && !role.isSkipped() && interaction.member.roles.cache.has(role.id)) {
            return true;
          }
        }
        return false;
      })();

      if (!isStaff) {
        await interaction.reply({ 
          content: '❌ Solo los miembros del staff pueden eliminar canales.', 
          ephemeral: true 
        });
        return;
      }

      // Guardar información final en la base de datos antes de eliminar
      try {
        if (interaction.channel.name.startsWith('donation-')) {
          const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
          if (donationRequest) {
            console.log(`💾 [BUTTON] Guardando información final antes de eliminar canal: ${donationRequest.id}`);
            
            // Guardar conversación final si no se había guardado
            const conversationResult = await donationRequest.saveConversation(interaction.channel);
            if (conversationResult.success) {
              console.log(`✅ [BUTTON] Conversación final guardada: ${conversationResult.messageCount} mensajes`);
            }
            
            // Marcar como eliminado por staff
            donationRequest.logActivity('channel_deleted', interaction.user.id, interaction.user.username, 'Canal eliminado por el staff');
            await donationRequest.save();
          }
        }

        // Guardar en sistema unificado
        const ticket = await Ticket.findByChannelId(interaction.channel.id);
        if (ticket) {
          ticket.updateStatus('archived', interaction.user.id, interaction.user.username, 'Canal eliminado por el staff');
          await ticket.save();
        }
      } catch (dbError) {
        console.error('❌ [BUTTON] Error al guardar información final:', dbError);
      }

      await interaction.reply({ 
        content: `🗑️ **Canal eliminado por ${interaction.user.username}**\n\n✅ Toda la información ha sido guardada en la base de datos.\n\n*Este canal se eliminará en 10 segundos...*`, 
        ephemeral: false 
      });

      // Eliminar el canal después de 10 segundos
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
          console.log(`✅ [BUTTON] Canal eliminado exitosamente por staff: ${interaction.user.username}`);
        } catch (error) {
          console.error('❌ [BUTTON] Error al eliminar canal:', error);
        }
      }, 10000);

    } catch (error) {
      console.error('❌ [BUTTON] Error al procesar eliminación de canal:', error);
      await interaction.reply({ 
        content: '❌ Hubo un error al eliminar el canal.', 
        ephemeral: true 
      });
    }
  },

  /**
   * Maneja la confirmación del comando nuclear (eliminar todos los canales)
   */
  nuclear_confirm: async (interaction) => {
    try {
      console.log(`💥 [NUCLEAR] Confirmación del comando nuclear por ${interaction.user.username}`);
      
      // Verificación adicional de seguridad
      const devId = "1363226308439576777";
      if (interaction.user.id !== devId) {
        await interaction.update({
          content: '🚫 **ACCESO DENEGADO**\n\nEste comando está restringido a una ID específica.',
          embeds: [],
          components: []
        });
        console.log(`🚨 [NUCLEAR] Intento de confirmación no autorizado por ${interaction.user.username} (${interaction.user.id})`);
        return;
      }

      await interaction.update({
        content: '💥 **INICIANDO DESTRUCCIÓN NUCLEAR...**\n\n⏳ Eliminando todos los canales...',
        embeds: [],
        components: []
      });

             // Ejecutar destrucción nuclear
       await nuclearCommand.executeNuclearDestruction(interaction);

    } catch (error) {
      console.error('❌ [NUCLEAR] Error en confirmación nuclear:', error);
      await interaction.update({
        content: '❌ Error crítico durante la operación nuclear.',
        embeds: [],
        components: []
      });
    }
  },

  /**
   * Maneja la cancelación del comando nuclear
   */
  nuclear_cancel: async (interaction) => {
    try {
      console.log(`🛑 [NUCLEAR] Comando nuclear cancelado por ${interaction.user.username}`);
      
      await interaction.update({
        content: '✅ **Operación cancelada**\n\nNo se eliminó ningún canal.',
        embeds: [],
        components: []
      });

    } catch (error) {
      console.error('❌ [NUCLEAR] Error al cancelar comando nuclear:', error);
      await interaction.update({
        content: '❌ Error al cancelar la operación.',
        embeds: [],
        components: []
      });
    }
  },

  /**
   * Handler para botón de detalles de sorteo
   */
  giveaway_detail_dynamic: async (interaction) => {
    try {
      const giveawayId = interaction.customId.replace('giveaway_detail_', '');
      const giveaway = await Giveaway.findOne({ id: giveawayId });
      if (!giveaway) {
        return await interaction.reply({ content: '❌ Sorteo no encontrado.', ephemeral: true });
      }
      const list = giveaway.participant_ids.slice(0, 25).map(id => `<@${id}>`).join(', ');

      // Construir embed de detalles
      const { EmbedBuilder } = require('discord.js');
      const unix = Math.floor(giveaway.end_at.getTime() / 1000);
      const embed = new EmbedBuilder()
        .setTitle('📋 Detalles del Sorteo')
        .setDescription(giveaway.description || 'Sin descripción')
        .addFields(
          { name: 'Premio', value: giveaway.prize, inline: true },
          { name: 'Lista (primeros 25)', value: list || 'Sin participantes' },
        )
        .setColor(0x3498DB)
        .setTimestamp();

      // Lista de participantes (máx 25 para evitar exceder)
      embed.addFields();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('❌ [BUTTON] Error mostrando detalles de sorteo:', err);
      await interaction.reply({ content: '❌ Error al mostrar detalles.', ephemeral: true });
    }
  },

  /**
   * Maneja el botón "Mis Premios"
   */
  profile_prizes_button: async (interaction) => {
    try {
      console.log(`🔘 [BUTTON] Procesando premios para ${interaction.user.username}`);

      // Obtener todos los premios del usuario
      const prizes = await Prize.find({ user_id: interaction.member.id }).sort({ date_won: -1 });

      // Si no hay premios, mostrar mensaje informativo
      if (prizes.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🏆 Mis Premios')
          .setDescription('¡Aún no has ganado premios! Participa en sorteos y eventos para conseguirlos.')
          .setColor(0xF1C40F)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🎉 Participa', value: 'Usa `/sorteo` para unirte a los próximos sorteos.', inline: false }
          );

        const navigationButtons = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('profile_view_button')
              .setLabel('Mi Perfil')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('👤'),
            new ButtonBuilder()
              .setCustomId('profile_donations_button')
              .setLabel('Mis Donaciones')
              .setStyle(ButtonStyle.Success)
              .setEmoji('💰'),
            new ButtonBuilder()
              .setCustomId('profile_stats_button')
              .setLabel('Estadísticas')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📊')
          );

        await interaction.update({ embeds: [embed], components: [navigationButtons] });
        return;
      }

      // Estadísticas de premios
      const totalPrizes = prizes.length;
      const deliveredPrizes = prizes.filter(p => p.status === 'entregado').length;
      const pendingPrizes = prizes.filter(p => p.status === 'pendiente').length;

      const embed = new EmbedBuilder()
        .setTitle('🏆 Mis Premios')
        .setDescription(`**Has ganado ${totalPrizes} premio${totalPrizes === 1 ? '' : 's'}**`)
        .setColor(0xF1C40F)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '📊 Resumen', value: `**Total:** ${totalPrizes}\n**✅ Entregados:** ${deliveredPrizes}\n**⏳ Pendientes:** ${pendingPrizes}`, inline: true }
        );

      // Listar los últimos 5 premios
      const recentPrizes = prizes.slice(0, 5);
      const statusEmoji = { 'pendiente': '⏳', 'entregado': '✅' };
      let prizeList = '';

      for (const prize of recentPrizes) {
        const wonDate = new Date(prize.date_won);
        prizeList += `${statusEmoji[prize.status] || '🎁'} **${prize.prize}**\n`;
        prizeList += `   └ <t:${Math.floor(wonDate.getTime() / 1000)}:R>\n`;
      }

      if (prizeList) {
        embed.addFields({ name: `📋 Últimos ${recentPrizes.length} Premios`, value: prizeList, inline: false });
      }

      embed.setFooter({ text: `${totalPrizes} premios totales` });

      const navigationButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_view_button')
            .setLabel('Mi Perfil')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👤'),
          new ButtonBuilder()
            .setCustomId('profile_donations_button')
            .setLabel('Mis Donaciones')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId('profile_stats_button')
            .setLabel('Estadísticas')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        );

      await interaction.update({ embeds: [embed], components: [navigationButtons] });

      console.log(`✅ [BUTTON] Premios mostrados para ${interaction.user.username} - ${totalPrizes} premios`);

    } catch (error) {
      console.error('❌ [BUTTON] Error al mostrar premios:', error);
      await interaction.reply({ content: '❌ Error al cargar tus premios. Inténtalo de nuevo.', ephemeral: true });
    }
  },

  /**
   * Maneja el botón "Premios Pendientes" (administración)
   */
  admin_prizes_pending_button: async (interaction) => {
    try {
      console.log(`🔘 [ADMIN] Revisando premios pendientes - solicitado por ${interaction.user.username}`);

      // Verificar permisos de staff
      const member = interaction.member;
      const staffRoleDocs = await Promise.all(staffRoles.map(a => RoleBot.findByAlias(a)));
      const staffRoleIds = staffRoleDocs.filter(Boolean).map(r => r.id);
      const hasStaff = staffRoleIds.some(id => member.roles.cache.has(id));
      if (!hasStaff) {
        return await interaction.reply({ content: '❌ No tienes permisos para usar esta función.', ephemeral: true });
      }

      // Obtener premios pendientes
      const pendingPrizes = await Prize.find({ status: 'pendiente' }).sort({ date_won: 1 }).limit(25);

      if (pendingPrizes.length === 0) {
        return await interaction.reply({ content: '✅ No hay premios pendientes de entrega.', ephemeral: true });
      }

      // Crear embed con lista
      const embed = new EmbedBuilder()
        .setTitle('⏳ Premios Pendientes')
        .setDescription(`Se encontraron **${pendingPrizes.length}** premio(s) pendientes. Usa los botones para marcarlos como entregados.`)
        .setColor(0xF1C40F)
        .setTimestamp();

      let description = '';
      pendingPrizes.forEach((p, idx) => {
        description += `${idx + 1}. <@${p.user_id}> • **${p.prize}** • <t:${Math.floor(new Date(p.date_won).getTime()/1000)}:d>\n`;
      });
      embed.addFields({ name: 'Lista', value: description.substring(0, 1024) });

      // Crear filas de botones (máx 5 por fila, 5 filas)
      const rows = [];
      let row = new ActionRowBuilder();
      pendingPrizes.forEach((p, idx) => {
        if (idx % 5 === 0 && idx !== 0) {
          rows.push(row);
          row = new ActionRowBuilder();
        }
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`admin_prize_markdelivered_${p._id}`)
            .setLabel(`${idx + 1}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
        );
      });
      if (row.components.length > 0) rows.push(row);

      await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });

    } catch (error) {
      console.error('❌ [ADMIN] Error al mostrar premios pendientes:', error);
      await interaction.reply({ content: '❌ Error al mostrar premios pendientes.', ephemeral: true });
    }
  },

  /**
   * Maneja botón dinámico para marcar premio como entregado
   */
  admin_prize_markdelivered_dynamic: async (interaction) => {
    try {
      const prizeId = interaction.customId.replace('admin_prize_markdelivered_', '');
      const prize = await Prize.findById(prizeId);
      if (!prize) {
        return await interaction.reply({ content: '❌ Premio no encontrado.', ephemeral: true });
      }
      if (prize.status === 'entregado') {
        return await interaction.reply({ content: '⚠️ Este premio ya fue marcado como entregado.', ephemeral: true });
      }

      // Verificar permisos de staff
      const member = interaction.member;
      const staffRoleDocs = await Promise.all(staffRoles.map(a => RoleBot.findByAlias(a)));
      const staffRoleIds = staffRoleDocs.filter(Boolean).map(r => r.id);
      const hasStaff = staffRoleIds.some(id => member.roles.cache.has(id));
      if (!hasStaff) {
        return await interaction.reply({ content: '❌ No tienes permisos para realizar esta acción.', ephemeral: true });
      }

      prize.status = 'entregado';
      prize.delivered_at = new Date();
      prize.delivered_by = interaction.user.id;
      await prize.save();

      await interaction.reply({ content: `🏆 Premio **${prize.prize}** marcado como entregado a <@${prize.user_id}>.`, ephemeral: true });
      console.log(`✅ [ADMIN] Premio ${prizeId} entregado por ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ [ADMIN] Error al marcar premio como entregado:', error);
      await interaction.reply({ content: '❌ Error al actualizar el premio.', ephemeral: true });
    }
  },
};

// Importar la función desde nuclear.js para evitar duplicación
const nuclearCommand = require('../../commands_slash/nuclear.js');

/**
 * Maneja el cierre de tickets de donación (6 horas de gracia)
 */
async function handleDonationTicketClosure(interaction, ticketCreatorId, staffMemberWhoProcessed) {
  try {
    console.log(`🎁 [DONATION] Iniciando cierre de ticket de donación con 6 horas de gracia`);
    
    // Crear botón para reabrir (disponible por 6 horas)
    const reopenButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('reopen_ticket_button')
          .setLabel('Reabrir Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
      );

    // **ELIMINAR PERMISOS DE ESCRITURA INMEDIATAMENTE (pero mantener lectura)**
    if (ticketCreatorId) {
      await interaction.channel.permissionOverwrites.edit(ticketCreatorId, {
        ViewChannel: true,
        SendMessages: false,  // NO puede escribir mientras esté cerrado
        ReadMessageHistory: true
      });
      console.log(`🚫 [DONATION] Usuario pierde permisos de escritura: ${ticketCreatorId}`);
    }

    await interaction.channel.send({ 
      content: `🗑️ **Ticket cerrado **\n\n⏰ **Tienes 6 horas** para reabrir este ticket si necesitas agregar información adicional.\n\n🔄 **Puedes reabrirlo** usando el botón que aparecerá abajo.\n⏳ **Acceso válido hasta:** ${new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`, 
      components: [reopenButton]
    });
    
    console.log(`✅ [DONATION] Ticket de donación cerrado temporalmente, usuario mantiene acceso por 6 horas`);
    
    // **PROGRAMAR ELIMINACIÓN DEL USUARIO DESPUÉS DE 6 HORAS**
    setTimeout(async () => {
      try {
        // Verificar si el ticket fue reabierto
        const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
        if (donationRequest && donationRequest.status === 'closed') {
          
          // **AHORA SÍ ELIMINAR AL USUARIO DESPUÉS DE 6 HORAS**
          if (ticketCreatorId) {
            await interaction.channel.permissionOverwrites.edit(ticketCreatorId, {
              ViewChannel: false,
              SendMessages: false,
              ReadMessageHistory: false
            });
            console.log(`🚫 [DONATION] Usuario eliminado del canal después de 6 horas: ${ticketCreatorId}`);
          }
          
          // Notificar al staff y mostrar botón de eliminar canal
          await finalizeTicketClosure(interaction.channel, staffMemberWhoProcessed);
        } else {
          console.log(`⚠️ [DONATION] Ticket fue reabierto, cancelando eliminación de usuario`);
        }
      } catch (error) {
        console.error('❌ [DONATION] Error al finalizar cierre de ticket:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 horas = 21600000 ms

  } catch (error) {
    console.error('❌ [DONATION] Error al manejar cierre de ticket de donación:', error);
    throw error;
  }
}

/**
 * Maneja el cierre de tickets normales (nuevo flujo: 1 hora sin escribir + eliminar usuario + 24h auto-close)
 */
async function handleRegularTicketClosure(interaction) {
  try {
    console.log(`🎫 [REGULAR] Iniciando nuevo flujo de cierre de ticket normal`);
    
    // Buscar el ticket en la base de datos para obtener información
    const ticket = await Ticket.findByChannelId(interaction.channel.id);
    let ticketCreatorId = null;
    let staffAssignedId = null;
    let staffAssignedUsername = null;
    
    if (ticket) {
      ticketCreatorId = ticket.creator_id;
      staffAssignedId = ticket.assigned_to;
      staffAssignedUsername = ticket.assigned_to_username;
    } else {
      // Fallback: extraer del nombre del canal
      const channelNameMatch = interaction.channel.name.match(/^ticket-(.+?)-/);
      if (channelNameMatch) {
        // Intentar encontrar el usuario por nombre
        const guild = interaction.guild;
        const member = guild.members.cache.find(m => m.user.username === channelNameMatch[1]);
        if (member) {
          ticketCreatorId = member.id;
        }
      }
    }
    
    // **PASO 1: QUITAR PERMISOS DE ESCRITURA AL USUARIO INMEDIATAMENTE**
    if (ticketCreatorId) {
      await interaction.channel.permissionOverwrites.edit(ticketCreatorId, {
        ViewChannel: true,
        SendMessages: false,  // NO puede escribir
        ReadMessageHistory: true
      });
      console.log(`🚫 [REGULAR] Usuario pierde permisos de escritura inmediatamente: ${ticketCreatorId}`);
    }
    
    // Crear botón para reabrir
    const reopenButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('reopen_ticket_button')
          .setLabel('Reabrir Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
      );

    await interaction.channel.send({ 
      content: `🗑️ **Ticket cerrado**\n\n⏰ **Tienes 1 hora** para reabrir este ticket si necesitas agregar información adicional.\n\n🔄 **Puedes reabrirlo** usando el botón que aparecerá abajo.\n⏳ **Acceso válido hasta:** ${new Date(Date.now() + 60 * 60 * 1000).toLocaleString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`, 
      components: [reopenButton]
    });
    
    console.log(`✅ [REGULAR] Ticket ${interaction.channel.name} cerrado, usuario pierde escritura, eliminación programada en 1 hora`);
    
    // **PASO 2: PROGRAMAR ELIMINACIÓN DEL USUARIO DESPUÉS DE 1 HORA**
    setTimeout(async () => {
      try {
        console.log(`⏰ [REGULAR] Han pasado 1 hora, verificando si el ticket fue reabierto...`);
        
        // Verificar si el ticket fue reabierto
        const updatedTicket = await Ticket.findByChannelId(interaction.channel.id);
        if (updatedTicket && updatedTicket.status === 'closed') {
          
          // **ELIMINAR AL USUARIO DEL CANAL**
          if (ticketCreatorId) {
            await interaction.channel.permissionOverwrites.edit(ticketCreatorId, {
              ViewChannel: false,
              SendMessages: false,
              ReadMessageHistory: false
            });
            console.log(`🚫 [REGULAR] Usuario eliminado del canal después de 1 hora: ${ticketCreatorId}`);
          }
          
          // **NOTIFICAR AL STAFF ASIGNADO**
          await finalizeRegularTicketClosure(interaction.channel, staffAssignedId, staffAssignedUsername);
        } else {
          console.log(`⚠️ [REGULAR] Ticket fue reabierto, cancelando eliminación de usuario`);
        }
      } catch (error) {
        console.error('❌ [REGULAR] Error al finalizar cierre de ticket tras 1 hora:', error);
      }
    }, 60 * 60 * 1000); // 1 hora = 3600000 ms

    // **PASO 3: PROGRAMAR CIERRE AUTOMÁTICO DEL CANAL A LAS 24 HORAS**
    setTimeout(async () => {
      try {
        console.log(`⏰ [REGULAR] Han pasado 24 horas, cerrando canal automáticamente...`);
        
        // Verificar si el canal aún existe
        const channel = interaction.guild.channels.cache.get(interaction.channel.id);
        if (channel) {
          await channel.send('⚠️ **Canal cerrándose automáticamente...**\n\n*Han pasado 24 horas desde que se cerró el ticket.*\n\n*Este canal se eliminará en 30 segundos...*');
          
          setTimeout(async () => {
            try {
              await channel.delete();
              console.log(`✅ [REGULAR] Canal eliminado automáticamente tras 24 horas: ${interaction.channel.name}`);
            } catch (error) {
              console.error('❌ [REGULAR] Error al eliminar canal tras 24 horas:', error);
            }
          }, 30000); // 30 segundos para que el mensaje se vea
        } else {
          console.log(`⚠️ [REGULAR] Canal ya fue eliminado manualmente`);
        }
      } catch (error) {
        console.error('❌ [REGULAR] Error al cerrar canal automáticamente tras 24 horas:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 horas = 86400000 ms

  } catch (error) {
    console.error('❌ [REGULAR] Error al manejar cierre de ticket normal:', error);
    throw error;
  }
}

/**
 * Finaliza el cierre del ticket después de 6 horas
 */
async function finalizeTicketClosure(channel, staffMemberWhoProcessed) {
  try {
    console.log(`🏁 [DONATION] Finalizando cierre de ticket después de 6 horas`);
    
    // Notificar al staff que procesó el ticket
    let staffMention = '';
    if (staffMemberWhoProcessed) {
      staffMention = `<@${staffMemberWhoProcessed.id}>`;
    }
    
    // Crear botón para eliminar canal (solo para staff)
    const deleteChannelButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('delete_channel_button')
          .setLabel('Eliminar Canal')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );

    const finalEmbed = new EmbedBuilder()
      .setTitle('✅ Ticket Finalizado')
      .setDescription('El ticket ha sido cerrado definitivamente. El usuario no reactivó el ticket durante las 6 horas de gracia.')
      .setColor(0x00FF00)
      .addFields(
        { name: '⏰ Tiempo de Gracia', value: '6 horas (expirado)', inline: true },
        { name: '👤 Usuario', value: 'Acceso eliminado', inline: true },
        { name: '🎯 Estado', value: 'Listo para eliminación', inline: true }
      )
      .setTimestamp();

    await channel.send({ 
      content: `${staffMention}\n\n**🎉 Ticket procesado exitosamente**\n\nEl usuario no reactivó el ticket durante las 6 horas de gracia. El ticket está listo para ser eliminado.`,
      embeds: [finalEmbed],
      components: [deleteChannelButton]
    });
    
    console.log(`✅ [DONATION] Ticket finalizado, esperando eliminación manual por staff`);

  } catch (error) {
    console.error('❌ [DONATION] Error al finalizar ticket:', error);
  }
}

/**
 * Finaliza el cierre del ticket normal después de 1 hora (notifica al staff asignado)
 */
async function finalizeRegularTicketClosure(channel, staffAssignedId, staffAssignedUsername) {
  try {
    console.log(`🏁 [REGULAR] Finalizando cierre de ticket normal después de 1 hora`);
    
    // Notificar al staff asignado o buscar staff disponible
    let staffMention = '';
    if (staffAssignedId) {
      staffMention = `<@${staffAssignedId}>`;
    } else {
      // Si no hay staff asignado, etiquetar roles de staff
      const { RoleBot } = require('../database/models');
      const staffRoles = ['admin', 'moderador']; // Ajusta según tu configuración
      
      for (const roleAlias of staffRoles) {
        const role = await RoleBot.findByAlias(roleAlias);
        if (role && !role.isSkipped()) {
          staffMention += `<@&${role.id}> `;
        }
      }
    }
    
    // Crear botón para eliminar canal (solo para staff)
    const deleteChannelButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('delete_channel_button')
          .setLabel('Eliminar Canal')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );

    const finalEmbed = new EmbedBuilder()
      .setTitle('✅ Ticket Listo para Gestión')
      .setDescription('El usuario no reactivó el ticket durante la 1 hora de gracia y ha sido eliminado del canal.')
      .setColor(0xF39C12)
      .addFields(
        { name: '⏰ Tiempo de Gracia', value: '1 hora (expirado)', inline: true },
        { name: '👤 Usuario', value: 'Eliminado del canal', inline: true },
        { name: '🎯 Estado', value: 'Esperando gestión del staff', inline: true },
        { name: '⏳ Cierre Automático', value: 'En 23 horas', inline: true },
        { name: '👨‍💼 Staff Asignado', value: staffAssignedUsername || 'No asignado', inline: true },
        { name: '🗑️ Opciones', value: 'Eliminar manualmente o esperar cierre automático', inline: true }
      )
      .setTimestamp();

    await channel.send({ 
      content: `${staffMention}\n\n**🎫 Ticket listo para tu gestión**\n\nEl usuario no reactivó el ticket durante la 1 hora de gracia y ha sido eliminado del canal.\n\n**📝 Puedes:**\n• Eliminar el canal manualmente si ya no es necesario\n• Dejar que se elimine automáticamente en 23 horas\n• Revisar la conversación guardada en la base de datos`,
      embeds: [finalEmbed],
      components: [deleteChannelButton]
    });
    
    console.log(`✅ [REGULAR] Ticket finalizado, staff notificado para gestión: ${staffAssignedUsername || 'Sin asignar'}`);

  } catch (error) {
    console.error('❌ [REGULAR] Error al finalizar ticket regular:', error);
  }
}

/**
 * Función principal para manejar todas las interacciones de botones
 */
async function handleButtonInteraction(interaction) {
  let handler;
  let handlerName = interaction.customId;
  
  // Verificar si es un select menu de moneda con custom_id dinámico
  if (interaction.customId.startsWith('donation_currency_select_')) {
    handler = buttonHandlers['donation_currency_select'];
    handlerName = 'donation_currency_select';
  }
  // Verificar si es un botón de reabrir canal de donación con custom_id dinámico
  else if (interaction.customId.startsWith('reopen_donation_channel_')) {
    handler = buttonHandlers['reopen_donation_channel'];
    handlerName = 'reopen_donation_channel';
  } 
  else if (interaction.customId.startsWith('giveaway_detail_')) {
    handler = buttonHandlers['giveaway_detail_dynamic'];
    handlerName = 'giveaway_detail_dynamic';
  }
  else if (interaction.customId.startsWith('admin_prize_markdelivered_')) {
    handler = buttonHandlers['admin_prize_markdelivered_dynamic'];
    handlerName = 'admin_prize_markdelivered_dynamic';
  } 
  else {
    handler = buttonHandlers[interaction.customId];
  }
  
  // Manejo especial para select menus administrativos
  if (!handler && interaction.isStringSelectMenu()) {
    const adminSelectMenus = [
      'admin_tickets_manage_select',
      'admin_tickets_status_filter',
      'admin_tickets_type_filter',
      'admin_tickets_priority_filter'
    ];
    
    if (adminSelectMenus.includes(interaction.customId)) {
      handler = buttonHandlers[interaction.customId];
      handlerName = interaction.customId;
    }
    
    // Manejo especial para select menus de canales administrativos del setup
    if (interaction.customId.startsWith('admin_channel_')) {
      console.log(`🏛️ [BUTTON-MANAGER] Select menu administrativo detectado: ${interaction.customId} - Ignorando router (manejado por setup)`);
      return; // No procesar, dejar que el setup lo maneje
    }
  }
  
  if (handler) {
    console.log(`🔘 [BUTTON-MANAGER] Manejando ${interaction.isStringSelectMenu() ? 'select menu' : 'botón'}: ${handlerName}`);
    await handler(interaction);
  } else {
    console.warn(`⚠️ [BUTTON-MANAGER] ${interaction.isStringSelectMenu() ? 'Select menu' : 'Botón'} no reconocido: ${interaction.customId}`);
    await interaction.reply({ 
      content: '❌ Acción no reconocida. Por favor, contacta a un administrador.', 
      ephemeral: true 
    });
  }
}

module.exports = {
  handleButtonInteraction,
  buttonHandlers
}; 