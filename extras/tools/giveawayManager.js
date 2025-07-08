const { Collection } = require('discord.js');
const { Giveaway } = require('../database/models');

/**
 * Manejador de Sorteos (Giveaways)
 * - Programa sorteos pendientes al iniciar el bot
 * - Permite agendar nuevos sorteos en caliente
 * - Selecciona al ganador automáticamente y lo anuncia
 */
class GiveawayManager {
  constructor(client) {
    this.client = client;

    /**
     * Map<string, NodeJS.Timeout>
     * Mapea el ID del sorteo al timeout programado
     */
    this.timeouts = new Collection();

    // Cola de IDs de sorteos que deben procesarse secuencialmente
    this.finishQueue = [];
    this.isProcessingFinish = false;
  }

  /* ---------------------------------------------------------------------- */
  /*  API PÚBLICA                                                           */
  /* ---------------------------------------------------------------------- */

  /**
   * Carga sorteos pendientes desde la base de datos y los programa.
   */
  async init() {
    try {
      console.log('[GIVEAWAY] Cargando sorteos pendientes…');
      const pending = await Giveaway.findPending();
      console.log(`[GIVEAWAY] Encontrados ${pending.length} sorteos pendientes.`);

      for (const giveaway of pending) {
        this._scheduleTimeout(giveaway);
      }
    } catch (error) {
      console.error('❌ [GIVEAWAY] Error al inicializar GiveawayManager:', error);
    }
  }

  /**
   * Programa un sorteo recién creado.
   * @param {Giveaway} giveaway Instancia ya guardada en MongoDB
   */
  scheduleNewGiveaway(giveaway) {
    if (!giveaway || giveaway.status !== 'pending') return;
    this._scheduleTimeout(giveaway);
  }

  /**
   * Cancela un sorteo (y su timeout) si está pendiente.
   * @param {String} giveawayId
   */
  cancelGiveaway(giveawayId) {
    const timeout = this.timeouts.get(giveawayId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(giveawayId);
      console.log(`[GIVEAWAY] Timeout cancelado para sorteo ${giveawayId}`);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  IMPLEMENTACIÓN PRIVADA                                                */
  /* ---------------------------------------------------------------------- */

  _scheduleTimeout(giveaway) {
    const delay = giveaway.end_at.getTime() - Date.now();

    // Si la fecha ya pasó, ejecutar inmediatamente (1 seg de colchón)
    const timeoutMs = delay <= 0 ? 1000 : delay;

    const timeout = setTimeout(() => {
      this._enqueueFinish(giveaway.id);
    }, timeoutMs);

    this.timeouts.set(giveaway.id, timeout);
    console.log(`[GIVEAWAY] Sorteo ${giveaway.id} programado en ${(timeoutMs/1000).toFixed(0)} segundos.`);
  }

  /** Encola un sorteo para ser finalizado de manera serial */
  _enqueueFinish(giveawayId) {
    this.finishQueue.push(giveawayId);
    this._processFinishQueue();
  }

  async _processFinishQueue() {
    if (this.isProcessingFinish) return;
    const nextId = this.finishQueue.shift();
    if (!nextId) return;

    this.isProcessingFinish = true;
    try {
      await this._finishGiveaway(nextId);
    } catch (err) {
      console.error('[GIVEAWAY] Error procesando sorteo en cola:', err);
    } finally {
      this.isProcessingFinish = false;
      // Procesar siguiente, si existe
      if (this.finishQueue.length > 0) {
        // Pequeña pausa de 1s entre sorteos para evitar solaparse visualmente
        setTimeout(() => this._processFinishQueue(), 1000);
      }
    }
  }

  async _finishGiveaway(giveawayId) {
    try {
      // Obtener sorteo actualizado
      const giveaway = await Giveaway.findOne({ id: giveawayId });
      let revealMsg; // mensaje que se irá editando durante la animación y al final

      if (!giveaway) return console.warn(`[GIVEAWAY] Sorteo ${giveawayId} no encontrado al finalizar.`);
      if (giveaway.status !== 'pending') return console.warn(`[GIVEAWAY] Sorteo ${giveawayId} ya está ${giveaway.status}.`);

      // Seleccionar ganador
      const participants = giveaway.participant_ids;
      const excluded = giveaway.excluded_ids || [];
      const eligible = participants.filter(id => !excluded.includes(id));

      if (!eligible || eligible.length === 0) {
        giveaway.status = 'cancelled';
        await giveaway.save();
        return console.warn(`[GIVEAWAY] Sorteo ${giveawayId} cancelado: sin participantes.`);
      }
      const winnerId = eligible[Math.floor(Math.random() * eligible.length)];

      // Obtener username del ganador (podría no estar en caché)
      let winnerUser;
      try {
        winnerUser = await this.client.users.fetch(winnerId);
      } catch (e) {
        console.warn('[GIVEAWAY] No se pudo fetch el usuario ganador:', e);
      }

      giveaway.setWinner(winnerId, winnerUser?.username || null);
      await giveaway.save();

      /* ------------------------------------------------------------------ */
      /*  ACTUALIZAR MENSAJE ORIGINAL DEL SORTEO                           */
      /* ------------------------------------------------------------------ */
      // El bloque de actualización de mensaje original se moverá más abajo

      let displayWinner = null; // se definirá más adelante si corresponde
      const mention = winnerUser ? `<@${winnerUser.id}>` : `Usuario ${winnerId}`;
      const winnerMsg = `🎉 **¡Ha finalizado el sorteo de ${giveaway.prize}!** 🎉\n`+
                        `Ganador: ${mention} 🥳`;

      // Anunciar en el canal principal del sorteo con animación
      const channel = await this.client.channels.fetch(giveaway.channel_id).catch(() => null);
      if (channel) {
        const replyOptions = giveaway.message_id ? { reply: { messageReference: giveaway.message_id } } : {};
        const { EmbedBuilder } = require('discord.js');


        // Preparar menciones (limitadas) y timestamp de inicio
        const startTs = Math.floor((Date.now() + 7000) / 1000); // 7s en el futuro
        const mentionList = participants.slice(0, 30).map(id => `<@${id}>`).join(' ');

        const embed = new EmbedBuilder()
          .setTitle(`🎉 ¡Comienza ${giveaway.title || 'el sorteo'}! 🎉`)
          .setDescription(`${mentionList}\n\n⏳ Inicia en <t:${startTs}:R>`)  // cuenta regresiva automática
          .setColor(0xE67E22);

        revealMsg = await channel.send({ embeds: [embed], ...replyOptions });

        // Esperar hasta que termine la cuenta atrás
        await new Promise(res => setTimeout(res, 7000));

        // Construir lista de nombres (máx 25) para grid
        const sampleIds = [...participants].slice(0, 25);
        const nameCache = {};
        for (const pid of sampleIds) {
          try {
            const usr = await this.client.users.fetch(pid);
            nameCache[pid] = usr.username;
          } catch {
            nameCache[pid] = `User${pid.slice(-4)}`;
          }
        }
        let namesArr = sampleIds.map(id => nameCache[id]);

        const renderGrid = (arr) => {
          const rows = [];
          for (let i = 0; i < arr.length; i += 5) {
            const row = arr.slice(i, i + 5).join('  ');
            rows.push(row);
          }
          return rows.join('\n');
        };

        // Fase: Barajando rápido 3 veces
        embed.setTitle(`🃏 Barajando nombres de ${giveaway.title || 'el sorteo'}…`);
        const barajarPhrases = ['🔀 Mezclando cartas…', '🤹‍♂️ Revolviendo nombres…', '🎲 Lanzando los dados…'];
        embed.setFooter({ text: barajarPhrases[Math.floor(Math.random()*barajarPhrases.length)] });
        for (let i = 0; i < 3; i++) {
          // shuffle
          namesArr.sort(() => Math.random() - 0.5);
          embed.setDescription(renderGrid(namesArr));
          await revealMsg.edit({ embeds: [embed] });
          await new Promise(res => setTimeout(res, 1000));
        }

        const MIN_FINAL = 8;
        if (namesArr.length > MIN_FINAL) {
          embed.setTitle(`💥 Eliminando participantes de ${giveaway.title || 'el sorteo'}…`);
          const elimPhrases = ['🔥 Solo los mejores sobreviven…', '✂️ Recortando la lista…', '🚽 Descartando a algunos…'];
          embed.setFooter({ text: elimPhrases[Math.floor(Math.random()*elimPhrases.length)] });

          while (namesArr.length > MIN_FINAL) {
            // recalcular según tamaño actual
            let removeCount;
            if (namesArr.length > 24) removeCount = 10;
            else if (namesArr.length > 18) removeCount = 6;
            else if (namesArr.length > 12) removeCount = 4;
            else removeCount = 2;

            removeCount = Math.min(removeCount, namesArr.length - MIN_FINAL);
            namesArr.sort(() => Math.random() - 0.5);
            namesArr = namesArr.slice(0, namesArr.length - removeCount);

            // Forzar que los excluidos se eliminen primero
            namesArr = namesArr.filter(idOrName => !excluded.includes(idOrName));
            // if still above min, remove additional

            const grid = renderGrid(namesArr.map((n, idx) =>
               idx === 0 ? `__**${n}**__` : `${n}`));

            embed.setDescription(grid.length ? grid : '...');
            await revealMsg.edit({ embeds: [embed] });
            await new Promise(res => setTimeout(res, 1500));
          }
        }

        // Fase: Eligiendo ganador con placeholders
        embed.setTitle(`🎯 Eligiendo ganador de ${giveaway.title || 'el sorteo'}…`);

        const choosePhrases = [ '🤔 Pensando, pensando…', '🍀 ¡Suerte a todos!', '🎰 Girando la ruleta…' ];
        embed.setFooter({ text: choosePhrases[Math.floor(Math.random()*choosePhrases.length)] });

        // 3 barajadas de placeholders
        for (let step = 0; step < 3; step++) {
          const placeholders = namesArr.map(() => '?'.repeat(4 + Math.floor(Math.random() * 4)));
          placeholders.sort(() => Math.random() - 0.5);
          embed.setDescription(`Eligiendo ganador:\n${placeholders.join('  ')}`);
          await revealMsg.edit({ embeds: [embed] });
          await new Promise(res => setTimeout(res, 1000));
        }

        // Mensaje de casi
        embed.setFooter({ text: 'Ya casi tengo uno 😜' });
        await revealMsg.edit({ embeds: [embed] });
        await new Promise(res => setTimeout(res, 2000));
        embed.setFooter(null);

        // Ganador real
        displayWinner = `<@${winnerId}>`;

        embed.setTitle(`🏆 ¡Ganador de ${giveaway.title || 'el sorteo'}! 🏆`)
          .setColor(0x2ECC71)
          .setDescription(`Felicidades ${displayWinner} 🎉\n\n**Premio:** ${giveaway.prize}`);
        await revealMsg.edit({ embeds: [embed] });

        // Fin animación

        // SHORT PAUSE
        await new Promise(res => setTimeout(res, 1000));

        /* ------------------------------------------------------------------ */
        /*  ACTUALIZAR MENSAJE ORIGINAL DEL SORTEO (después de la animación)  */
        /* ------------------------------------------------------------------ */
        if (giveaway.message_id) {
          try {
            const { EmbedBuilder } = require('discord.js');
            const gChannel = await this.client.channels.fetch(giveaway.channel_id).catch(() => null);
            if (gChannel) {
              const originalMsg = await gChannel.messages.fetch(giveaway.message_id).catch(() => null);
              if (originalMsg) {
                const unixEnd = Math.floor(giveaway.end_at.getTime() / 1000);

                const finishedEmbed = new EmbedBuilder()
                  .setTitle(`🏁 ${giveaway.title || 'Sorteo'} • ¡Finalizado! 🏁`)
                  .setColor(0x27AE60)
                  .setDescription(`🎉 **Premio:** ${giveaway.prize} \n${giveaway.description ? '📝 ' + giveaway.description : ''}`)
                  .addFields(
                    { name: '👥 Participantes', value: `${giveaway.participant_ids.length}`, inline: true },
                    { name: '📅 Finalizado', value: `<t:${unixEnd}:F>\n(<t:${unixEnd}:R>)`, inline: true },
                    { name: '🥇 Ganador', value: displayWinner }
                  )
                  .setFooter({ text: '¡Felicitaciones al ganador!', iconURL: this.client.user.displayAvatarURL() })
                  .setTimestamp()

                await originalMsg.edit({ embeds: [finishedEmbed], components: [] }).catch(() => null);
              }
            }
          } catch (editErr) {
            console.error('[GIVEAWAY] Error actualizando mensaje original:', editErr);
          }
        }


      } else {
        console.warn('[GIVEAWAY] Canal no encontrado para anunciar el ganador');
      }

      // Anunciar adicionalmente en chat general si corresponde
      if (giveaway.announce_general !== false) {
        const { ChannelBot } = require('../database/models');
        let generalChannel = null;

        try {
          const generalDoc = await ChannelBot.findByAlias('chatGeneral');
          if (generalDoc && !generalDoc.isSkipped()) {
            generalChannel = await this.client.channels.fetch(generalDoc.id).catch(() => null);
          }
        } catch (e) {
          console.warn('[GIVEAWAY] Error buscando ChannelBot chatGeneral:', e);
        }

        // Fallback: buscar canal que contenga "general" si no se encontró via BD
        if (!generalChannel) {
          const guild = this.client.guilds.cache.get(giveaway.guild_id || this.client.guilds.cache.first()?.id);
          if (guild) {
            generalChannel = guild.channels.cache.find(ch => ch.name.toLowerCase().includes('general') && ch.isTextBased());
          }
        }

        if (generalChannel && generalChannel.id !== giveaway.channel_id) {
          const { EmbedBuilder } = require('discord.js');
          const embedWinnerGen = new EmbedBuilder()
            .setTitle(`🏆 ¡Ganador de ${giveaway.title || 'el sorteo'}! 🏆`)
            .setColor(0xF1C40F)
            .setDescription(`🎉 Felicidades ${displayWinner} 🎉`)
            .addFields(
              { name: '🎁 Premio', value: `**${giveaway.prize}**` },
              { name: '\u200B', value: `${'🎉'.repeat(15)}` }
            )
            .setFooter({ text: '¡Disfruta tu premio!', iconURL: this.client.user.displayAvatarURL() })
            .setTimestamp();

          // Enviar embed ganador también al canal original del sorteo
          try {
            await revealMsg.edit({ embeds: [embedWinnerGen] });
          } catch (sendErr) {
            console.error('[GIVEAWAY] Error enviando embed ganador al canal de sorteo:', sendErr);
          }

          // Añadir miniatura del ganador
          if (winnerUser) {
            embedWinnerGen.setThumbnail(winnerUser.displayAvatarURL({ size: 256 }));
          }

          generalChannel.send({ embeds: [embedWinnerGen] }).catch(console.error);
        } else {
          console.warn('[GIVEAWAY] Canal general no encontrado o coincide con canal del sorteo, no se envía anuncio general');
        }
      }

      // Registrar premio en colección Prize
      try {
        const { Prize } = require('../database/models');
        await Prize.create({
          user_id: winnerId,
          user_username: winnerUser?.username || null,
          type_event: 'sorteo',
          id_event: giveaway.id,
          prize: giveaway.prize,
          status: 'pendiente'
        });
      } catch (prErr) {
        console.error('[GIVEAWAY] Error registrando premio:', prErr);
      }

      console.log(`[GIVEAWAY] Sorteo ${giveaway.id} completado. Ganador: ${winnerId}`);

    } catch (error) {
      console.error('❌ [GIVEAWAY] Error al finalizar sorteo:', error);
    } finally {
      // Limpiar timeout del mapa
      this.timeouts.delete(giveawayId);
    }
  }
}

// Instance singleton -------------------------------------------------------
let instance = null;

/**
 * Crea (o devuelve) una instancia singleton de GiveawayManager.
 * @param {import('discord.js').Client} client
 */
function getGiveawayManager(client) {
  if (!instance) {
    if (!client) throw new Error('Se requiere el Discord Client para inicializar GiveawayManager la primera vez.');
    instance = new GiveawayManager(client);
  }
  return instance;
}

module.exports = {
  getGiveawayManager,
}; 