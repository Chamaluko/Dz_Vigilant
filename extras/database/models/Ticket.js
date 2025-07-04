const mongoose = require('mongoose');

// Esquema para el historial de estados del ticket
const ticketHistorySchema = new mongoose.Schema({
    status: { type: String, required: true },
    changed_by: { type: String, required: true }, // Discord ID
    changed_by_username: { type: String, required: true },
    changed_at: { type: Date, default: Date.now },
    reason: { type: String, default: null },
    notes: { type: String, default: null }
}, { _id: false });

// Esquema para archivos adjuntos
const attachmentSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    proxy_url: { type: String, default: null },
    size: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    content_type: { type: String, default: null },
    description: { type: String, default: null }
}, { _id: false });

// Esquema para mensajes de la conversación
const conversationMessageSchema = new mongoose.Schema({
    message_id: { type: String, required: true },
    author_id: { type: String, required: true },
    author_username: { type: String, required: true },
    author_display_name: { type: String, default: null },
    content: { type: String, default: '' },
    timestamp: { type: Date, required: true },
    edited_timestamp: { type: Date, default: null },
    message_type: { 
        type: String, 
        enum: [
            'DEFAULT', 'RECIPIENT_ADD', 'RECIPIENT_REMOVE', 'CALL', 
            'CHANNEL_NAME_CHANGE', 'CHANNEL_ICON_CHANGE', 'CHANNEL_PINNED_MESSAGE', 
            'USER_JOIN', 'GUILD_BOOST', 'GUILD_BOOST_TIER_1', 'GUILD_BOOST_TIER_2', 
            'GUILD_BOOST_TIER_3', 'CHANNEL_FOLLOW_ADD', 'GUILD_DISCOVERY_DISQUALIFIED', 
            'GUILD_DISCOVERY_REQUALIFIED', 'GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING', 
            'GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING', 'THREAD_CREATED', 'REPLY', 
            'APPLICATION_COMMAND', 'THREAD_STARTER_MESSAGE', 'GUILD_INVITE_REMINDER', 
            'CONTEXT_MENU_COMMAND'
        ],
        default: 'DEFAULT'
    },
    attachments: [attachmentSchema],
    embeds_count: { type: Number, default: 0 },
    reactions_count: { type: Number, default: 0 },
    is_pinned: { type: Boolean, default: false },
    referenced_message_id: { type: String, default: null }, // Para replies
    is_bot: { type: Boolean, default: false },
    is_system: { type: Boolean, default: false }
}, { _id: false });

// Esquema principal del Ticket
const ticketSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    status: { 
        type: String, 
        required: true, 
        enum: ['open', 'closed', 'reopened', 'escalated', 'resolved', 'archived'], 
        default: 'open',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
        index: true
    },
    
    // Información del creador
    creator_id: { type: String, required: true, index: true },
    creator_username: { type: String, required: true },
    
    // Información del canal
    channel_id: { type: String, required: true, unique: true, index: true },
    channel_name: { type: String, required: true },
    
    // Información del staff asignado
    assigned_to: { type: String, default: null },
    assigned_to_username: { type: String, default: null },
    assigned_at: { type: Date, default: null },
    
    // Contenido del ticket
    title: { type: String, default: null },
    description: { type: String, default: null },
    
    // Información de tiempo
    first_response_at: { type: Date, default: null },
    last_activity_at: { type: Date, default: Date.now },
    closed_at: { type: Date, default: null },
    resolved_at: { type: Date, default: null },
    
    // Información del cierre
    closed_by: { type: String, default: null },
    closed_by_username: { type: String, default: null },
    close_reason: { type: String, default: null },
    
    // Información adicional
    tags: [{ type: String }],
    notes: { type: String, default: null },
    satisfaction_rating: { type: Number, min: 1, max: 5, default: null },
    
    // Contadores
    message_count: { type: Number, default: 0 },
    reopen_count: { type: Number, default: 0 },
    
    // Historial de cambios
    history: [ticketHistorySchema],
    
    // Conversación completa del ticket
    conversation: [conversationMessageSchema],
    conversation_saved_at: { type: Date, default: null }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'tickets'
});

// Métodos del esquema
ticketSchema.methods.updateStatus = function(newStatus, changedBy, changedByUsername, reason = null, notes = null) {
    const oldStatus = this.status;
    this.status = newStatus;
    this.last_activity_at = new Date();
    
    // Agregar al historial
    this.history.push({
        status: newStatus,
        changed_by: changedBy,
        changed_by_username: changedByUsername,
        reason: reason,
        notes: notes
    });
    
    // Actualizar campos específicos según el estado
    if (newStatus === 'closed') {
        this.closed_at = new Date();
        this.closed_by = changedBy;
        this.closed_by_username = changedByUsername;
        this.close_reason = reason;
    } else if (newStatus === 'reopened') {
        this.reopen_count += 1;
        this.closed_at = null;
        this.closed_by = null;
        this.closed_by_username = null;
        this.close_reason = null;
    } else if (newStatus === 'resolved') {
        this.resolved_at = new Date();
    }
    
    return { oldStatus, newStatus };
};

ticketSchema.methods.assignTo = function(staffId, staffUsername) {
    this.assigned_to = staffId;
    this.assigned_to_username = staffUsername;
    this.assigned_at = new Date();
    this.last_activity_at = new Date();
    
    this.history.push({
        status: this.status,
        changed_by: staffId,
        changed_by_username: staffUsername,
        reason: 'Ticket asignado',
        notes: `Asignado a ${staffUsername}`
    });
};

ticketSchema.methods.addNote = function(note, addedBy, addedByUsername) {
    this.notes = this.notes ? `${this.notes}\n\n[${new Date().toLocaleString('es-ES')} - ${addedByUsername}]: ${note}` : `[${new Date().toLocaleString('es-ES')} - ${addedByUsername}]: ${note}`;
    this.last_activity_at = new Date();
    
    this.history.push({
        status: this.status,
        changed_by: addedBy,
        changed_by_username: addedByUsername,
        reason: 'Nota agregada',
        notes: note
    });
};

ticketSchema.methods.updatePriority = function(newPriority, changedBy, changedByUsername, reason = null) {
    const oldPriority = this.priority;
    this.priority = newPriority;
    this.last_activity_at = new Date();
    
    this.history.push({
        status: this.status,
        changed_by: changedBy,
        changed_by_username: changedByUsername,
        reason: reason || `Prioridad cambiada de ${oldPriority} a ${newPriority}`,
        notes: `Prioridad: ${oldPriority} → ${newPriority}`
    });
};

ticketSchema.methods.recordFirstResponse = function() {
    if (!this.first_response_at) {
        this.first_response_at = new Date();
        this.last_activity_at = new Date();
    }
};

ticketSchema.methods.incrementMessageCount = function() {
    this.message_count += 1;
    this.last_activity_at = new Date();
};

ticketSchema.methods.setSatisfactionRating = function(rating, ratedBy, ratedByUsername) {
    this.satisfaction_rating = rating;
    this.last_activity_at = new Date();
    
    this.history.push({
        status: this.status,
        changed_by: ratedBy,
        changed_by_username: ratedByUsername,
        reason: 'Calificación agregada',
        notes: `Calificación: ${rating}/5 estrellas`
    });
};

// Método para capturar toda la conversación del canal
ticketSchema.methods.saveConversation = async function(channel) {
    try {
        console.log(`💬 [TICKET] Iniciando captura de conversación para ticket ${this.id} en canal ${channel.name}`);
        
        const messages = [];
        let lastMessageId = null;
        let totalMessages = 0;
        
        // Mapeo de tipos de mensaje de Discord.js (números) a strings
        const messageTypeMap = {
            0: 'DEFAULT',
            1: 'RECIPIENT_ADD',
            2: 'RECIPIENT_REMOVE', 
            3: 'CALL',
            4: 'CHANNEL_NAME_CHANGE',
            5: 'CHANNEL_ICON_CHANGE',
            6: 'CHANNEL_PINNED_MESSAGE',
            7: 'USER_JOIN',
            8: 'GUILD_BOOST',
            9: 'GUILD_BOOST_TIER_1',
            10: 'GUILD_BOOST_TIER_2',
            11: 'GUILD_BOOST_TIER_3',
            12: 'CHANNEL_FOLLOW_ADD',
            14: 'GUILD_DISCOVERY_DISQUALIFIED',
            15: 'GUILD_DISCOVERY_REQUALIFIED',
            16: 'GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING',
            17: 'GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING',
            18: 'THREAD_CREATED',
            19: 'REPLY',
            20: 'APPLICATION_COMMAND',
            21: 'THREAD_STARTER_MESSAGE',
            22: 'GUILD_INVITE_REMINDER',
            23: 'CONTEXT_MENU_COMMAND'
        };
        
        // Obtener todos los mensajes del canal (Discord permite máximo 100 por request)
        while (true) {
            const options = { limit: 100 };
            if (lastMessageId) {
                options.before = lastMessageId;
            }
            
            const batch = await channel.messages.fetch(options);
            if (batch.size === 0) break;
            
            // Procesar cada mensaje del batch
            for (const [messageId, message] of batch) {
                // Convertir tipo de mensaje de número a string
                const messageTypeNum = message.type;
                const messageTypeStr = messageTypeMap[messageTypeNum] || 'DEFAULT';
                
                // Debug: log si encontramos un tipo desconocido
                if (!messageTypeMap[messageTypeNum]) {
                    console.log(`⚠️ [TICKET] Tipo de mensaje desconocido: ${messageTypeNum} en mensaje ${messageId}`);
                }
                
                const messageData = {
                    message_id: message.id,
                    author_id: message.author.id,
                    author_username: message.author.username,
                    author_display_name: message.member?.displayName || message.author.displayName || null,
                    content: message.content || '',
                    timestamp: message.createdAt,
                    edited_timestamp: message.editedAt,
                    message_type: messageTypeStr,
                    embeds_count: message.embeds.length,
                    reactions_count: message.reactions.cache.size,
                    is_pinned: message.pinned,
                    referenced_message_id: message.reference?.messageId || null,
                    is_bot: message.author.bot,
                    is_system: message.system,
                    attachments: []
                };
                
                // Procesar attachments (imágenes, archivos, etc.)
                if (message.attachments.size > 0) {
                    for (const [attachmentId, attachment] of message.attachments) {
                        messageData.attachments.push({
                            id: attachment.id,
                            name: attachment.name,
                            url: attachment.url,
                            proxy_url: attachment.proxyURL,
                            size: attachment.size,
                            width: attachment.width || null,
                            height: attachment.height || null,
                            content_type: attachment.contentType || null,
                            description: attachment.description || null
                        });
                    }
                }
                
                messages.push(messageData);
                totalMessages++;
            }
            
            lastMessageId = batch.last().id;
            
            // Evitar rate limits
            if (batch.size < 100) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Ordenar mensajes por fecha (más antiguos primero)
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Estadísticas por tipo de mensaje
        const messageTypeCounts = {};
        messages.forEach(msg => {
            messageTypeCounts[msg.message_type] = (messageTypeCounts[msg.message_type] || 0) + 1;
        });
        
        // Guardar la conversación en el ticket
        this.conversation = messages;
        this.conversation_saved_at = new Date();
        this.message_count = totalMessages;
        
        console.log(`✅ [TICKET] Conversación capturada: ${totalMessages} mensajes, ${messages.filter(m => m.attachments.length > 0).length} con archivos`);
        console.log(`📊 [TICKET] Tipos de mensaje:`, messageTypeCounts);
        
        return {
            total_messages: totalMessages,
            messages_with_attachments: messages.filter(m => m.attachments.length > 0).length,
            total_attachments: messages.reduce((sum, m) => sum + m.attachments.length, 0),
            message_types: messageTypeCounts
        };
        
    } catch (error) {
        console.error(`❌ [TICKET] Error al capturar conversación para ticket ${this.id}:`, error);
        throw error;
    }
};

// Método para obtener tiempo de respuesta
ticketSchema.methods.getResponseTime = function() {
    if (!this.first_response_at) return null;
    return this.first_response_at.getTime() - this.created_at.getTime();
};

// Método para obtener tiempo de resolución
ticketSchema.methods.getResolutionTime = function() {
    if (!this.resolved_at) return null;
    return this.resolved_at.getTime() - this.created_at.getTime();
};

// Método para verificar si está activo
ticketSchema.methods.isActive = function() {
    return ['open', 'reopened', 'escalated'].includes(this.status);
};

// Método para exportar conversación en formato legible
ticketSchema.methods.exportConversation = function() {
    if (!this.conversation || this.conversation.length === 0) {
        return '📭 No hay conversación guardada para este ticket.';
    }
    
    let export_text = `📚 **CONVERSACIÓN DEL TICKET ${this.id}**\n`;
    export_text += `🎫 **Estado:** ${this.status}\n`;
    export_text += `👤 **Creador:** ${this.creator_username} (${this.creator_id})\n`;
    export_text += `📅 **Creado:** ${this.created_at.toLocaleString('es-ES')}\n`;
    export_text += `💾 **Conversación guardada:** ${this.conversation_saved_at?.toLocaleString('es-ES') || 'No guardada'}\n`;
    export_text += `💬 **Total mensajes:** ${this.conversation.length}\n\n`;
    export_text += `${'='.repeat(50)}\n\n`;
    
    for (const msg of this.conversation) {
        const timestamp = msg.timestamp.toLocaleString('es-ES');
        const author = msg.author_display_name || msg.author_username;
        const botFlag = msg.is_bot ? ' 🤖' : '';
        const systemFlag = msg.is_system ? ' ⚙️' : '';
        
        export_text += `[${timestamp}] ${author}${botFlag}${systemFlag}:\n`;
        
        if (msg.content) {
            export_text += `${msg.content}\n`;
        }
        
        if (msg.attachments && msg.attachments.length > 0) {
            export_text += `📎 **Archivos adjuntos:**\n`;
            for (const attachment of msg.attachments) {
                export_text += `  • ${attachment.name} (${attachment.size} bytes) - ${attachment.url}\n`;
            }
        }
        
        if (msg.embeds_count > 0) {
            export_text += `📄 **Embeds:** ${msg.embeds_count}\n`;
        }
        
        if (msg.reactions_count > 0) {
            export_text += `👍 **Reacciones:** ${msg.reactions_count}\n`;
        }
        
        export_text += `\n`;
    }
    
    return export_text;
};

// Método para obtener estadísticas de la conversación
ticketSchema.methods.getConversationStats = function() {
    if (!this.conversation || this.conversation.length === 0) {
        return null;
    }
    
    const stats = {
        total_messages: this.conversation.length,
        messages_by_user: {},
        messages_with_attachments: 0,
        total_attachments: 0,
        total_embeds: 0,
        total_reactions: 0,
        bot_messages: 0,
        system_messages: 0,
        first_message_date: null,
        last_message_date: null
    };
    
    for (const msg of this.conversation) {
        // Contar por usuario
        if (!stats.messages_by_user[msg.author_username]) {
            stats.messages_by_user[msg.author_username] = 0;
        }
        stats.messages_by_user[msg.author_username]++;
        
        // Contar attachments
        if (msg.attachments && msg.attachments.length > 0) {
            stats.messages_with_attachments++;
            stats.total_attachments += msg.attachments.length;
        }
        
        // Otros contadores
        stats.total_embeds += msg.embeds_count || 0;
        stats.total_reactions += msg.reactions_count || 0;
        
        if (msg.is_bot) stats.bot_messages++;
        if (msg.is_system) stats.system_messages++;
        
        // Fechas
        if (!stats.first_message_date || msg.timestamp < stats.first_message_date) {
            stats.first_message_date = msg.timestamp;
        }
        if (!stats.last_message_date || msg.timestamp > stats.last_message_date) {
            stats.last_message_date = msg.timestamp;
        }
    }
    
    return stats;
};

// Middleware pre-save para validaciones
ticketSchema.pre('save', function (next) {
    // Validar IDs de Discord
    if (this.creator_id && !this.creator_id.match(/^\d+$/)) {
        return next(new Error('El creator_id debe ser un ID de Discord válido'));
    }
    
    if (this.assigned_to && !this.assigned_to.match(/^\d+$/)) {
        return next(new Error('El assigned_to debe ser un ID de Discord válido'));
    }
    
    // Validar que el channel_id sea único
    if (this.channel_id && !this.channel_id.match(/^\d+$/)) {
        return next(new Error('El channel_id debe ser un ID de Discord válido'));
    }
    
    next();
});

// Crear el modelo
const Ticket = mongoose.model('Ticket', ticketSchema);

// Métodos estáticos
Ticket.findByChannelId = function (channelId) {
    return this.findOne({ channel_id: channelId });
};

Ticket.findByCreatorId = function (creatorId) {
    return this.find({ creator_id: creatorId }).sort({ created_at: -1 });
};

Ticket.findByStatus = function (status) {
    return this.find({ status }).sort({ created_at: -1 });
};

// findByType removed - cada tipo tiene su propia BD

Ticket.findActiveTickets = function () {
    return this.find({ status: { $in: ['open', 'reopened', 'escalated'] } }).sort({ created_at: -1 });
};

Ticket.findByAssignedTo = function (staffId) {
    return this.find({ assigned_to: staffId }).sort({ created_at: -1 });
};

Ticket.findByPriority = function (priority) {
    return this.find({ priority }).sort({ created_at: -1 });
};

Ticket.getStats = function () {
    return this.aggregate([
        {
            $facet: {
                byStatus: [
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                byPriority: [
                    { $group: { _id: '$priority', count: { $sum: 1 } } }
                ],
                avgResponseTime: [
                    { $match: { first_response_at: { $ne: null } } },
                    { $group: { _id: null, avgTime: { $avg: { $subtract: ['$first_response_at', '$created_at'] } } } }
                ],
                avgResolutionTime: [
                    { $match: { resolved_at: { $ne: null } } },
                    { $group: { _id: null, avgTime: { $avg: { $subtract: ['$resolved_at', '$created_at'] } } } }
                ],
                totalStats: [
                    { $group: { 
                        _id: null, 
                        total: { $sum: 1 },
                        avgSatisfaction: { $avg: '$satisfaction_rating' },
                        totalMessages: { $sum: '$message_count' }
                    }}
                ]
            }
        }
    ]);
};

Ticket.generateId = function () {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `ticket_${timestamp}_${random}`;
};

module.exports = Ticket; 