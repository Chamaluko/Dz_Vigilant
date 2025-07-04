const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { RoleBot, DonationRequest, CompletedDonation, UserProfile, ChannelBot, Ticket } = require('../database/models');
const {rolesBot, donationSettings} = require('../../config/defaults.json');
const validations = require('./validations');
/**
 * Manejadores de modales organizados por funcionalidad
 */
const modalHandlers = {
  
  /**
   * Maneja el formulario de reclamo de donación completado
   */
  donation_claim_modal: async (interaction) => {
    try {
      console.log(`🖼️ [MODAL] Procesando formulario de reclamo de ${interaction.user.username}`);
      
      // Parsear el custom_id para extraer método de pago y moneda
      const customId = interaction.customId;
      let paymentMethod, currency, amount, comments, currencyType, usdApprox;
      
      if (customId.startsWith('donation_claim_modal_')) {
        // NUEVO FORMATO: custom_id incluye método de pago y moneda
        const parts = customId.replace('donation_claim_modal_', '').split('_');
        
        if (parts.length >= 2) {
          // Formato: donation_claim_modal_[PAYMENT_METHOD]_[CURRENCY]
          currency = parts[parts.length - 1]; // Última parte es la moneda
          paymentMethod = parts.slice(0, -1).join('_'); // Todo menos la última parte
          
          amount = interaction.fields.getTextInputValue('donation_amount') || 'No especificado';
          comments = interaction.fields.getTextInputValue('donation_comments') || 'Sin comentarios';
          
          // Para moneda OTHER, obtener campos adicionales
          if (currency === 'OTHER') {
            currencyType = interaction.fields.getTextInputValue('currency_type') || 'No especificada';
            usdApprox = interaction.fields.getTextInputValue('usd_approximate') || 'No especificado';
          }
          
          console.log(`🔄 [MODAL] Nuevo formato con moneda - Método: ${paymentMethod}, Moneda: ${currency}`);
        } else {
          // Formato viejo sin moneda
          paymentMethod = parts[0];
          currency = 'USD'; // Por defecto
          amount = interaction.fields.getTextInputValue('donation_amount') || 'No especificado';
          comments = interaction.fields.getTextInputValue('donation_comments') || 'Sin comentarios';
          console.log(`🔄 [MODAL] Formato legacy con moneda por defecto USD - Método: ${paymentMethod}`);
        }
      } else {
        // FORMATO MUY VIEJO: para compatibilidad completa
        amount = interaction.fields.getTextInputValue('donation_amount');
        paymentMethod = interaction.fields.getTextInputValue('payment_method');
        comments = interaction.fields.getTextInputValue('proof_and_comments') || 'Sin comentarios';
        currency = 'USD'; // Por defecto
        console.log(`🔄 [MODAL] Formato legacy completo`);
      }



      // RESPONDER INMEDIATAMENTE PARA EVITAR TIMEOUT
      await interaction.reply({ 
        content: `✅ ¡Procesando tu reclamo de premios! Creando ticket...`, 
        flags: MessageFlags.Ephemeral 
      });

      // Verificar si el usuario ya tiene un ticket de reclamo abierto (por estado pending o reopened)
      const existingRequest = await DonationRequest.findOne({ 
        member_id: interaction.member.id, 
        status: { $in: ['pending', 'reopened'] }
      });
      
      if (existingRequest && existingRequest.channel_id) {
        const existingChannel = interaction.guild.channels.cache.get(existingRequest.channel_id);
        if (existingChannel) {
          console.log(`⚠️ [MODAL] Usuario ${interaction.user.username} ya tiene ticket de reclamo: ${existingChannel.name}`);
          await interaction.editReply({ 
            content: `❌ Ya tienes un ticket de reclamo abierto: ${existingChannel}\n\nSi no puedes verlo, contacta a un administrador.`
        });
        return;
        }
      }

      // Generar ID único para la nueva solicitud
      const requestId = DonationRequest.generateId();

      // Crear el ticket de reclamo
      const donationTicketChannel = await interaction.guild.channels.create({
        name: `donation-${requestId.split('_')[1]}`, // Usar parte del ID único
        type: 0, // GUILD_TEXT
        parent: null, // Puedes configurar una categoría específica para tickets de reclamo
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel'], // Denegar ver canal a @everyone
          },
          {
            id: interaction.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'], // Permitir al usuario
          },
          // Permitir a roles de staff (admin, mod, dueño)
          ...(await Promise.all(['dueño'].map(async (roleAlias) => {
            const role = await RoleBot.findByAlias(roleAlias);
            return role && !role.isSkipped() ? {
              id: role.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
            } : null;
          }))).filter(Boolean)
        ],
      });

      // Crear embed con la información del reclamo (incluyendo moneda)
      let currencyDisplay = '';
      if (currency === 'USD') {
        currencyDisplay = `$${amount} USD`;
      } else if (currency === 'CLP') {
        currencyDisplay = `$${amount} CLP`;
      } else if (currency === 'OTHER') {
        if (currencyType && currencyType !== 'No especificada') {
          currencyDisplay = `${amount} ${currencyType}`;
          if (usdApprox && usdApprox !== 'No especificado') {
            currencyDisplay += ` (~$${usdApprox} USD)`;
          }
        } else {
          currencyDisplay = `${amount} (moneda no especificada)`;
        }
      } else {
        currencyDisplay = `${amount} ${currency}`;
      }

      const donationEmbed = new EmbedBuilder()
        .setTitle('🎁 Reclamo de Premios de Donación')
        .setDescription(`**Jugador:** ${interaction.user}\n**Estado:** 🟡 Pendiente de verificación`)
        .setColor(0xFFD700)
        .addFields(
          { name: '💰 Cantidad Donada', value: currencyDisplay, inline: true },
          { name: '💱 Moneda', value: currency === 'OTHER' ? (currencyType || 'No especificada') : currency, inline: true },
          { name: '💳 Método de Pago', value: paymentMethod, inline: true },
          { name: '🆔 Member ID', value: interaction.member.id, inline: true },
          { name: '📅 Fecha de Solicitud', value: new Date().toLocaleString('es-ES'), inline: true },
          { name: '💬 Comentarios', value: comments, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: 'Sistema de Reclamos DZ Vigilant' });

      // Agregar campo adicional para moneda OTHER con USD aproximado
      if (currency === 'OTHER' && usdApprox && usdApprox !== 'No especificado') {
        donationEmbed.addFields({ 
          name: '💵 USD Aproximado', 
          value: `$${usdApprox} USD`, 
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

      // Enviar mensaje inicial en el ticket
      console.log('dueño');
      const dueñoRole = await RoleBot.findByAlias('dueño');
      console.log(dueñoRole);
      const roleMention = dueñoRole && !dueñoRole.isSkipped() ? `<@&${dueñoRole.id}>` : '';
      console.log(roleMention);
      await donationTicketChannel.send({ 
        content: `${interaction.user} | ${roleMention}`, 
        embeds: [donationEmbed], 
        components: [actionButtons] 
      });

      // Enviar instrucciones adicionales
      const instructionsEmbed = new EmbedBuilder()
        .setTitle('📋 Instrucciones para Completar tu Reclamo')
        .setDescription('**¡Gracias por donar al servidor!**\n\nPara completar tu reclamo, necesitamos verificar tu comprobante.')
        .setColor(0x3498DB)
        .addFields(
          {
            name: '🔍 Verificación de Comprobante',
            value: '**SUBE TU COMPROBANTE EN ESTE CANAL** como archivo adjunto.',
            inline: false
          },
          {
            name: '⏱️ Tiempo de Verificación',
            value: 'Los reclamos pueden tardar hasta más de 48 horas.',
            inline: false
          },
          {
            name: '📎 Formatos Aceptados',
            value: 'Capturas de pantalla, PDFs, imagenes, etc.',
            inline: false
          },
          {
            name: ':coin:  Entrega de Dz Coins',
            value: 'Una vez verificado tu pago, recibirás tus Dz Coins automáticamente en tu cuenta.',
            inline: false
          },
          {
            name: '❓ ¿Dudas o Problemas?',
            value: 'Escribe en este canal y el staff te ayudará lo antes posible.',
            inline: false
          }
        )
        .setFooter({ text: '**RECUERDA: SÓLO RECLAMAS DONACIONES YA REALIZADAS**' })
        .setTimestamp();

      await donationTicketChannel.send({ embeds: [instructionsEmbed] });

      // **CREAR REGISTRO ÚNICO EN LA BASE DE DATOS**
      const donationRequest = new DonationRequest({
        id: requestId,
        member_id: interaction.member.id,
        member_username: interaction.user.username,
        channel_id: donationTicketChannel.id,
        status: 'pending',
        amount: currencyDisplay, // Usar el display formateado
        payment_method: paymentMethod,
        currency: currency,
        currency_type: currencyType || null,
        usd_approximate: usdApprox || null,
        comments: comments
      });

      await donationRequest.save();
      console.log(`💾 [DATABASE] Solicitud de donación guardada en BD: ${donationRequest.id} - ${currency}: ${currencyDisplay}`);

      // Actualizar respuesta con éxito
      await interaction.editReply({ 
        content: `✅ ¡Reclamo de premios creado exitosamente!\n\nPuedes encontrar tu ticket aquí: ${donationTicketChannel}\n\n**📎 IMPORTANTE:** Si no pusiste un link del comprobante, súbelo como archivo en el ticket.\n\nUn miembro del staff verificará tu donación pronto.`
      });

      // ELIMINAR EL MENSAJE DEL SELECT MENU DESPUÉS DE PROCESAR EL MODAL
      try {
        const savedInteraction = global.selectMenuInteractions?.get(interaction.user.id);
        if (savedInteraction) {
          await savedInteraction.deleteReply();
          global.selectMenuInteractions.delete(interaction.user.id);
          console.log(`🗑️ [MODAL] Mensaje del select menu eliminado después de procesar el formulario para ${interaction.user.username}`);
        } else {
          console.warn(`⚠️ [MODAL] No se encontró interaction guardada para eliminar el select menu del usuario ${interaction.user.username}`);
        }
      } catch (deleteError) {
        console.warn(`⚠️ [MODAL] Error al eliminar mensaje del select menu:`, deleteError);
        // Limpiar la referencia aunque falle
        if (global.selectMenuInteractions?.has(interaction.user.id)) {
          global.selectMenuInteractions.delete(interaction.user.id);
        }
      }

      
      console.log(`✅ [MODAL] Ticket de reclamo creado para ${interaction.user.username}: ${donationTicketChannel.name} (ID: ${requestId})`);

    } catch (error) {
      console.error('❌ [MODAL] Error al procesar formulario de reclamo:', error);
      await interaction.reply({ 
        content: '❌ Hubo un error al procesar tu reclamo. Por favor, contacta a un administrador.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja el modal de rechazo de donación
   */
  reject_donation_modal: async (interaction) => {
    try {
      console.log(`🖼️ [MODAL] Procesando rechazo de donación por ${interaction.user.username}`);
      
      const rejectReason = interaction.fields.getTextInputValue('reject_reason');

      // Obtener información del ticket desde la base de datos por channel_id
      const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
      if (!donationRequest) {
        await interaction.reply({ 
          content: '❌ Este no parece ser un ticket de donación válido o no se encontró en la base de datos.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // **GUARDAR CONVERSACIÓN ANTES DE RECHAZAR**
      try {
          console.log(`💬 [MODAL] Guardando conversación antes de rechazar donación: ${donationRequest.id}`);
          
          // Guardar conversación
          const conversationResult = await donationRequest.saveConversation(interaction.channel);
          if (conversationResult.success) {
            console.log(`✅ [MODAL] Conversación guardada: ${conversationResult.messageCount} mensajes, ${conversationResult.attachmentCount} archivos`);
          } else {
            console.error(`❌ [MODAL] Error al guardar conversación: ${conversationResult.error}`);
          }
          
          // Rechazar solicitud
          donationRequest.reject(interaction.member.id, interaction.user.username, rejectReason);
          await donationRequest.save();
          console.log(`💾 [DATABASE] Solicitud rechazada en BD: ${donationRequest.id}`);
      } catch (dbError) {
        console.error('❌ [DATABASE] Error al actualizar estado en BD:', dbError);
      }

      // Crear embed de rechazo
      const embed = new EmbedBuilder()
        .setTitle('❌ Reclamo Rechazado')
        .setDescription(`Tu reclamo de premios ha sido **RECHAZADO** por ${interaction.user}.`)
        .setColor(0xFF0000)
        .addFields(
          {
            name: '📝 Razón del Rechazo',
            value: rejectReason,
            inline: false
          },
          {
            name: '🔄 ¿Qué puedes hacer?',
            value: '• Verificar que tu comprobante sea válido\n• Contactar al staff para aclarar dudas\n• Crear un nuevo reclamo con información correcta\n• Revisar los paquetes de donación disponibles',
            inline: false
          },
          {
            name: '⏰ Eliminación Automática',
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: `Revisado por ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });


      console.log(`✅ [MODAL] Reclamo rechazado para ${donationRequest.member_username} (ID: ${donationRequest.id}) por ${interaction.user.username}`);

    } catch (error) {
      console.error('❌ [MODAL] Error al procesar rechazo:', error);
      await interaction.reply({ 
        content: '❌ Error al procesar el rechazo.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja el modal de aprobación con DZ Coins específicos
   */
  approve_donation_coins_modal: async (interaction) => {
    try {
      console.log(`🖼️ [MODAL] Procesando aprobación con coins específicos por ${interaction.user.username}`);
      
      const dzCoinsAmount = parseInt(interaction.fields.getTextInputValue('dz_coins_amount')) || 0;
      const usdAmountReal = parseFloat(interaction.fields.getTextInputValue('usd_amount_real')) || 0;
      const approvalReason = interaction.fields.getTextInputValue('approval_reason') || 'Donación verificada y aprobada';

      if (dzCoinsAmount <= 0) {
        await interaction.reply({ 
          content: '❌ La cantidad de DZ Coins debe ser mayor que 0.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      if (usdAmountReal <= 0) {
        await interaction.reply({ 
          content: '❌ El monto USD debe ser mayor que 0.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // Obtener información del ticket desde la base de datos por channel_id
      const donationRequest = await DonationRequest.findByChannelId(interaction.channel.id);
      if (!donationRequest) {
        await interaction.reply({ 
          content: '❌ Este no parece ser un ticket de donación válido o no se encontró en la base de datos.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // **GUARDAR CONVERSACIÓN ANTES DE APROBAR**
      try {
          console.log(`💬 [MODAL] Guardando conversación antes de aprobar donación: ${donationRequest.id}`);
          
          // Guardar conversación
          const conversationResult = await donationRequest.saveConversation(interaction.channel);
          if (conversationResult.success) {
            console.log(`✅ [MODAL] Conversación guardada: ${conversationResult.messageCount} mensajes, ${conversationResult.attachmentCount} archivos`);
          } else {
            console.error(`❌ [MODAL] Error al guardar conversación: ${conversationResult.error}`);
          }
          
          // Aprobar solicitud
          donationRequest.approve(interaction.member.id, interaction.user.username);
          donationRequest.staff_notes = approvalReason;
          await donationRequest.save();
          
          // Otorgar DZ Coins al usuario
          const userProfile = await UserProfile.findOrCreate(
            donationRequest.member_id,
            donationRequest.member_username,
            donationRequest.member_username,
            new Date()
          );
          
          userProfile.addCoins(dzCoinsAmount, `Donación aprobada: $${usdAmountReal} USD (${donationRequest.payment_method})`);
          await userProfile.save();

          // Crear registro en CompletedDonation con monto USD real
          const completedDonation = new CompletedDonation({
            id: CompletedDonation.generateId(),
            member_id: donationRequest.member_id,
            member_username: donationRequest.member_username,
            amount_usd: usdAmountReal.toString(),
            payment_method: donationRequest.payment_method,
            dz_coins_given: dzCoinsAmount,
            approved_by_id: interaction.member.id,
            approved_by_username: interaction.user.username,
            approval_reason: approvalReason,
            original_request_id: donationRequest.id,
            status: 'completed'
          });

          await completedDonation.save();
          
          console.log(`💾 [DATABASE] Solicitud aprobada en BD: ${donationRequest.id}`);
          console.log(`💰 [COINS] ${userProfile.username} recibió ${dzCoinsAmount} DZ Coins por donación de $${usdAmountReal} USD`);
          console.log(`✅ [DATABASE] CompletedDonation creado: ${completedDonation.id}`);
        
      } catch (dbError) {
        console.error('❌ [DATABASE] Error al actualizar estado en BD:', dbError);
      }

      // Crear embed de aprobación
      const embed = new EmbedBuilder()
        .setTitle('✅ Reclamo de Premios Aprobado')
        .setDescription(`<@${donationRequest.member_id}> Tu reclamo ha sido **APROBADO** por ${interaction.user}.\n\n**¡Felicidades!** Tu donación ha sido verificada exitosamente.\n\n💰 **DZ Coins otorgados:** ${dzCoinsAmount} DZ Coins\n💵 **Monto verificado:** $${usdAmountReal} USD\n\n📝 **Comentario del staff:** ${approvalReason}`)
        .setColor(0x00FF00)
        .setTimestamp()
        .setFooter({ text: `Verificado por ${interaction.user.username} • ¡Revisa tu perfil para ver tus DZ Coins!` });

      await interaction.reply({ embeds: [embed] });



      console.log(`✅ [MODAL] Reclamo aprobado para ${donationRequest.member_username} (ID: ${donationRequest.id}) por ${interaction.user.username} - ${dzCoinsAmount} DZ Coins por $${usdAmountReal} USD`);

    } catch (error) {
      console.error('❌ [MODAL] Error al procesar aprobación:', error);
      await interaction.reply({ 
        content: '❌ Error al procesar la aprobación.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },

  /**
   * Maneja el modal de búsqueda de donaciones (Panel Jefatura)
   */
  admin_donations_search_modal: async (interaction) => {
    try {
      console.log(`🖼️ [MODAL] Procesando búsqueda de donaciones por ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_donations_search_modal');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const termino = interaction.fields.getTextInputValue('search_term');
      
      // Buscar en donaciones completadas
      const completedResults = await CompletedDonation.find({
        $or: [
          { amount_usd: { $regex: termino, $options: 'i' } },
          { payment_method: { $regex: termino, $options: 'i' } },
          { member_username: { $regex: termino, $options: 'i' } },
          { approved_by_username: { $regex: termino, $options: 'i' } }
        ]
      }).sort({ created_at: -1 }).limit(10);

      // Buscar en solicitudes
      const requestResults = await DonationRequest.find({
        $or: [
          { amount: { $regex: termino, $options: 'i' } },
          { payment_method: { $regex: termino, $options: 'i' } },
          { member_username: { $regex: termino, $options: 'i' } }
        ]
      }).sort({ created_at: -1 }).limit(10);

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Resultados de Búsqueda: "${termino}"`)
        .setColor(0x9B59B6)
        .setTimestamp();

      if (completedResults.length === 0 && requestResults.length === 0) {
        embed.setDescription('No se encontraron resultados para el término de búsqueda.');
      } else {
        if (completedResults.length > 0) {
          embed.addFields({
            name: `💎 Donaciones Completadas (${completedResults.length})`,
            value: completedResults.map(d => {
              const date = new Date(d.created_at).toLocaleDateString('es-ES');
              return `• **${d.member_username}** - $${d.amount_usd} USD (${d.payment_method}) - ${date}`;
            }).join('\n'),
            inline: false
          });
        }

        if (requestResults.length > 0) {
          embed.addFields({
            name: `📋 Solicitudes (${requestResults.length})`,
            value: requestResults.map(r => {
              const date = new Date(r.created_at).toLocaleDateString('es-ES');
              const status = r.status === 'pending' ? '⏳' : r.status === 'approved' ? '✅' : '❌';
              return `• **${r.member_username}** - $${r.amount} USD (${r.payment_method}) ${status} - ${date}`;
            }).join('\n'),
            inline: false
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ [MODAL] Error en búsqueda:', error);
      await interaction.editReply({ content: '❌ Error al realizar la búsqueda.' });
    }
  },

  /**
   * Maneja el modal de búsqueda de tickets (Panel Jefatura)
   */
  admin_tickets_search_modal: async (interaction) => {
    try {
      console.log(`🖼️ [MODAL] Procesando búsqueda de tickets por ${interaction.user.username}`);

      // Validación centralizada
      const validation = await validations.validateAdministrativeInteraction(interaction, 'admin_tickets_search_modal');
      if (!validation.isValid) {
        await interaction.reply({
          content: validation.errorMessage,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const termino = interaction.fields.getTextInputValue('search_term');
      
      // Buscar tickets por múltiples criterios
      const tickets = await Ticket.find({
        $or: [
          { title: { $regex: termino, $options: 'i' } },
          { description: { $regex: termino, $options: 'i' } },
          { creator_username: { $regex: termino, $options: 'i' } },
          { notes: { $regex: termino, $options: 'i' } },
          { id: { $regex: termino, $options: 'i' } },
          { assigned_to_username: { $regex: termino, $options: 'i' } }
        ]
      }).sort({ created_at: -1 }).limit(10);

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Resultados de Búsqueda de Tickets: "${termino}"`)
        .setColor(0x3498DB)
        .setTimestamp();

      if (tickets.length === 0) {
        embed.setDescription(`No se encontraron tickets que contengan: "${termino}"`);
      } else {
        tickets.forEach((ticket, index) => {
          const statusEmoji = { 
            open: '🟢', closed: '🔴', reopened: '🔄', 
            escalated: '🔺', resolved: '✅', archived: '📦' 
          }[ticket.status] || '❓';
          
          const typeEmoji = { 
            general: '🎫', donation: '💰', support: '🛠️', 
            report: '🚨', suggestion: '💡' 
          }[ticket.type] || '🎫';
          
          const priorityEmoji = { 
            urgent: '🔴', high: '🔶', normal: '⚪', low: '🔻' 
          }[ticket.priority] || '⚪';
          
          embed.addFields({
            name: `${statusEmoji} ${ticket.title || ticket.type}`,
            value: `**Usuario:** ${ticket.creator_username}\n**Tipo:** ${typeEmoji} ${ticket.type}\n**Estado:** ${ticket.status}\n**Prioridad:** ${priorityEmoji} ${ticket.priority}\n**Canal:** <#${ticket.channel_id}>\n**ID:** \`${ticket.id}\`\n**Creado:** <t:${Math.floor(ticket.created_at.getTime() / 1000)}:R>${ticket.assigned_to_username ? `\n**Asignado a:** ${ticket.assigned_to_username}` : ''}`,
            inline: true
          });
        });

        if (tickets.length === 10) {
          embed.setFooter({ text: 'Mostrando 10 resultados máximo' });
        }
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ [MODAL] Error en búsqueda de tickets:', error);
      await interaction.editReply({ content: '❌ Error al realizar la búsqueda de tickets.' });
    }
  }
};

/**
 * Función principal para manejar todas las interacciones de modales
 */
async function handleModalInteraction(interaction) {
  let handler;
  let handlerName = interaction.customId;
  
  // Verificar si es un modal de donación con custom_id dinámico
  if (interaction.customId.startsWith('donation_claim_modal_')) {
    handler = modalHandlers['donation_claim_modal'];
    handlerName = 'donation_claim_modal';
  } else {
    handler = modalHandlers[interaction.customId];
  }
  
  if (handler) {
    console.log(`🖼️ [MODAL-MANAGER] Manejando modal: ${handlerName} (customId: ${interaction.customId})`);
    await handler(interaction);
  } else {
    console.warn(`⚠️ [MODAL-MANAGER] Modal no reconocido: ${interaction.customId}`);
    await interaction.reply({ 
      content: '❌ Formulario no reconocido. Por favor, contacta a un administrador.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

module.exports = {
  handleModalInteraction,
  modalHandlers
}; 