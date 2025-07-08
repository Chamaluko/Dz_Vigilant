const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { randomUUID } = require('crypto');
const { Giveaway, ChannelBot, RoleBot } = require('../extras/database/models');
const { getGiveawayManager } = require('../extras/tools/giveawayManager');
const { DateTime } = require('luxon');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Declaración del módulo para sistema de permisos / configuración
const declareModule = {
  name: 'sorteo',
  description: 'Gestiona sorteos (giveaways) en el servidor',
  isEnabled: true,
  restriction: {
    roles: ['admin', 'dueño', 'mod'], // Personaliza según requieras
    ids: []
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName(declareModule.name)
    .setDescription(declareModule.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Subcomando TODOS
    .addSubcommand(sub => sub
      .setName('todos')
      .setDescription('Sorteo para todos los miembros')
      .addStringOption(opt => opt.setName('premio').setDescription('Premio del sorteo').setRequired(true))
      .addStringOption(opt => opt.setName('descripcion').setDescription('Descripción del sorteo').setRequired(true))
      .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del sorteo (opcional)').setRequired(false))
      .addStringOption(opt => opt.setName('fecha_fin').setDescription('Fecha y hora de fin (DD/MM/YYYY HH:mm)').setRequired(false))
      .addStringOption(opt => opt.setName('duracion').setDescription('Duración relativa, p.ej. 45s, 2h, 1d2h30m45s').setRequired(false))
      .addChannelOption(opt => opt.setName('canal').setDescription('Canal donde se publicará el sorteo (por defecto, #sorteos)').addChannelTypes(ChannelType.GuildText).setRequired(false))
      .addStringOption(opt => opt.setName('excluir').setDescription('IDs o menciones a excluir (aún aparecen, pero no ganan)').setRequired(false))
      .addBooleanOption(opt => opt.setName('general').setDescription('¿Anunciar ganador en chat general? (defecto: sí)').setRequired(false))
    )
    // Subcomando ROL
    .addSubcommand(sub => sub
      .setName('rol')
      .setDescription('Sorteo limitado a un rol')
      .addRoleOption(opt => opt.setName('rol').setDescription('Rol cuyos miembros participarán').setRequired(true))
      .addStringOption(opt => opt.setName('premio').setDescription('Premio del sorteo').setRequired(true))
      .addStringOption(opt => opt.setName('descripcion').setDescription('Descripción del sorteo').setRequired(true))
      .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del sorteo (opcional)').setRequired(false))
      .addStringOption(opt => opt.setName('fecha_fin').setDescription('Fecha y hora de fin (DD/MM/YYYY HH:mm)').setRequired(false))
      .addStringOption(opt => opt.setName('duracion').setDescription('Duración relativa, p.ej. 45s, 2h, 1d2h30m45s').setRequired(false))
      .addChannelOption(opt => opt.setName('canal').setDescription('Canal donde se publicará el sorteo (por defecto, #sorteos)').addChannelTypes(ChannelType.GuildText).setRequired(false))
      .addStringOption(opt => opt.setName('excluir').setDescription('IDs o menciones a excluir (aún aparecen, pero no ganan)').setRequired(false))
      .addBooleanOption(opt => opt.setName('general').setDescription('¿Anunciar ganador en chat general? (defecto: sí)').setRequired(false))
    )
    // Subcomando USUARIOS
    .addSubcommand(sub => sub
      .setName('usuarios')
      .setDescription('Sorteo para usuarios específicos')
      .addStringOption(opt => opt.setName('usuarios').setDescription('Lista de menciones o IDs separados por espacio').setRequired(true))
      .addStringOption(opt => opt.setName('premio').setDescription('Premio del sorteo').setRequired(true))
      .addStringOption(opt => opt.setName('descripcion').setDescription('Descripción del sorteo').setRequired(true))
      .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del sorteo (opcional)').setRequired(false))
      .addStringOption(opt => opt.setName('fecha_fin').setDescription('Fecha y hora de fin (DD/MM/YYYY HH:mm)').setRequired(false))
      .addStringOption(opt => opt.setName('duracion').setDescription('Duración relativa, p.ej. 45s, 2h, 1d2h30m45s').setRequired(false))
      .addChannelOption(opt => opt.setName('canal').setDescription('Canal donde se publicará el sorteo (por defecto, #sorteos)').addChannelTypes(ChannelType.GuildText).setRequired(false))
      .addStringOption(opt => opt.setName('excluir').setDescription('IDs o menciones a excluir (aún aparecen, pero no ganan)').setRequired(false))
      .addBooleanOption(opt => opt.setName('general').setDescription('¿Anunciar ganador en chat general? (defecto: sí)').setRequired(false))
    ),

  declareModule,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'todos') {
      await handleCreate(interaction, 'all');
    } else if (subcommand === 'rol') {
      await handleCreate(interaction, 'role');
    } else if (subcommand === 'usuarios') {
      await handleCreate(interaction, 'users');
    } else {
      await interaction.editReply('❌ Subcomando no reconocido');
    }
  }
};

/* ----------------------------------------------------------------------- */
/*  LÓGICA DE CREACIÓN DE SORTEO                                           */
/* ----------------------------------------------------------------------- */

async function handleCreate(interaction, criterio) {
  try {
    const rol = interaction.options.getRole('rol');
    const usuariosRaw = interaction.options.getString('usuarios');
    const premio = interaction.options.getString('premio');
    const fechaStr = interaction.options.getString('fecha_fin');
    const duracionStr = interaction.options.getString('duracion');
    const canal = interaction.options.getChannel('canal');
    const excluirRaw = interaction.options.getString('excluir');
    const general = interaction.options.getBoolean('general');
    const descripcion = interaction.options.getString('descripcion');
    const nombreOpcion = interaction.options.getString('nombre');

    // Determinar canal de publicación por defecto (alias sorteos) si no se pasó opcional
    let publishChannel = canal;
    if (!publishChannel) {
      const sorteosDoc = await ChannelBot.findByAlias('sorteos');
      if (sorteosDoc && !sorteosDoc.isSkipped()) {
        publishChannel = interaction.guild.channels.cache.get(sorteosDoc.id) || null;
      }
    }
    if (!publishChannel) publishChannel = interaction.channel;

    // Validaciones básicas
    if (criterio === 'role' && !rol) {
      return await interaction.editReply('❌ Debes especificar el rol cuando el criterio es "rol".');
    }
    if (criterio === 'users' && !usuariosRaw) {
      return await interaction.editReply('❌ Debes especificar la lista de usuarios cuando el criterio es "usuarios".');
    }

    // Obtener endDate a partir de fecha absoluta o duración
    let endDate;
    if (fechaStr) {
      endDate = parseDateString(fechaStr);
      if (!endDate || isNaN(endDate.getTime())) {
        return await interaction.editReply('❌ Formato de fecha inválido. Usa DD/MM/YYYY HH:mm (24h).');
      }
    } else if (duracionStr) {
      const durMs = parseDurationMs(duracionStr);
      if (durMs === null) {
        return await interaction.editReply('❌ Formato de duración inválido. Ejemplos válidos: 30m, 2h, 1d2h30m40s');
      }
      endDate = new Date(Date.now() + durMs);
    } else {
      return await interaction.editReply('❌ Debes proporcionar `fecha_fin` o `duracion`.');
    }

    if (endDate.getTime() <= Date.now()) {
      return await interaction.editReply('❌ La fecha y hora deben estar en el futuro.');
    }

    let participantIds = [];
    const guild = interaction.guild;

    // Obtener Role IDs de roles administrativos
    const adminAliases = ['dueño', 'admin', 'mod'];
    const adminRoleIds = [];
    for (const alias of adminAliases) {
      const roleDoc = await RoleBot.findByAlias(alias);
      if (roleDoc && !roleDoc.isSkipped()) {
        adminRoleIds.push(roleDoc.id);
      }
    }

    const isAdminMember = (member) => adminRoleIds.some(rid => member.roles.cache.has(rid));

    if (criterio === 'all') {
      // Todos los miembros no bots excluyendo admins
      const members = await guild.members.fetch();
      participantIds = members
        .filter(m => !m.user.bot && !isAdminMember(m))
        .map(m => m.user.id);
    } else if (criterio === 'role') {
      participantIds = rol.members
        .filter(m => !m.user.bot && !isAdminMember(m))
        .map(m => m.user.id);
    } else if (criterio === 'users') {
      participantIds = parseUserIds(usuariosRaw);
      // Verificar que IDs existan y que no sean admin/bot
      participantIds = participantIds.filter(id => {
        const mem = guild.members.cache.get(id);
        return mem && !mem.user.bot && !isAdminMember(mem);
      });
    }

    if (participantIds.length === 0) {
      return await interaction.editReply('❌ No se encontraron participantes con los criterios dados.');
    }

    // Parsear exclusiones
    let excludedIds = [];
    if (excluirRaw) {
      excludedIds = parseUserIds(excluirRaw).filter(id => participantIds.includes(id));
    }

    // Asegurar que excluidos estén en participantIds (si no, los agregamos para visual)
    for (const exId of excludedIds) {
      if (!participantIds.includes(exId)) participantIds.push(exId);
    }

    // Crear sorteo en la BD (message_id se añadirá luego)
    let tituloSorteo = nombreOpcion;
    if (!tituloSorteo || !tituloSorteo.trim()) {
      const totalPrevios = await Giveaway.countDocuments({ guild_id: guild.id }).catch(() => 0);
      tituloSorteo = `Sorteo N°${totalPrevios + 1}`;
    }

    const giveaway = new Giveaway({
      id: randomUUID(),
      guild_id: guild.id,
      channel_id: publishChannel.id,
      created_by_id: interaction.user.id,
      created_by_username: interaction.user.username,
      criteria_type: criterio,
      role_id: rol?.id || null,
      role_name: rol?.name || null,
      user_ids: criterio === 'users' ? participantIds : [],
      participant_ids: participantIds,
      excluded_ids: excludedIds,
      prize: premio,
      end_at: endDate,
      status: 'pending',
      announce_general: general !== false,
      description: descripcion,
      title: tituloSorteo
    });

    await giveaway.save();

    // Programar sorteo
    const gm = getGiveawayManager(interaction.client);
    gm.scheduleNewGiveaway(giveaway);

    // Mensaje público del sorteo
    const unix = Math.floor(endDate.getTime() / 1000);
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${tituloSorteo} 🎉`)
      .setColor(0xF39C12)
      .addFields(
        { name: '🎁 Premio', value: `${premio}`, inline: true },
        { name: '👤 Participantes', value: `${participantIds.length}`, inline: true },
        { name: '📅 Finaliza', value: `<t:${unix}:F>`, inline: true },
        { name: '⏳ Tiempo restante', value: `<t:${unix}:R>` }
      )
      .setFooter({ text: '¡Mucha suerte a todos! 🍀' })
      .setTimestamp();

    if (descripcion) {
      embed.setDescription(`📝 ${descripcion}`);
    }

    const detailsButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_detail_${giveaway.id}`)
        .setLabel('Detalles')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );

    const publicMsg = await publishChannel.send({ embeds: [embed], components: [detailsButton] });

    // Guardar message_id
    giveaway.message_id = publicMsg.id;
    await giveaway.save();

    // Confirmar al usuario (ephemeral)
    const timeLeftMinutes = Math.round((endDate.getTime() - Date.now()) / 60000);
    await interaction.editReply(
      `🎉 Sorteo creado correctamente. Participantes: **${participantIds.length}**.\n` +
      `Premio: **${premio}**.\n` +
      `Se publicó el sorteo en ${publishChannel}.\n` +
      `Ganador en <t:${unix}:F> (⏳ <t:${unix}:R>)`
    );
  } catch (error) {
    console.error('❌ Error al crear sorteo:', error);
    await interaction.editReply('❌ Hubo un error al crear el sorteo.');
  }
}

/* ----------------------------------------------------------------------- */
/*  HELPERS                                                                 */
/* ----------------------------------------------------------------------- */

function parseDateString(str) {
  // Espera formato DD/MM/YYYY HH:mm (hora local Chile)
  const dt = DateTime.fromFormat(str.trim(), 'dd/MM/yyyy HH:mm', { zone: 'America/Santiago' });
  if (!dt.isValid) return null;
  return dt.toJSDate(); // Convertir a objeto Date en UTC equivalente
}

function parseUserIds(raw) {
  if (!raw) return [];
  const ids = raw.split(/\s+/).filter(Boolean).map(token => {
    // Si viene en formato <@123456789> o <@!123456789>
    const mentionMatch = token.match(/<@!?(\d+)>/);
    return mentionMatch ? mentionMatch[1] : token;
  });
  // Quitar duplicados
  return [...new Set(ids)];
}

function parseDurationMs(str) {
  // Soporta combinaciones como 1d2h30m45s
  const regex = /(\d+)\s*([dhms])/g;
  let totalMs = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'm':
        totalMs += amount * 60 * 1000;
        break;
      case 'h':
        totalMs += amount * 60 * 60 * 1000;
        break;
      case 'd':
        totalMs += amount * 24 * 60 * 60 * 1000;
        break;
      case 's':
        totalMs += amount * 1000;
        break;
      default:
        return null;
    }
  }
  return totalMs > 0 ? totalMs : null;
} 