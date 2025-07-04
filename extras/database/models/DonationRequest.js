const mongoose = require('mongoose');

// Esquema para Solicitudes de Donación
const donationRequestSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    member_id: { type: String, required: true, index: true },
    member_username: { type: String, required: true },
    channel_id: { type: String,  default: null },
    status: { 
        type: String, 
        required: true, 
        enum: ['pending', 'approved', 'rejected', 'closed', 'reopened'], 
        default: 'pending',
        index: true
    },
    amount: { type: String, required: true },
    payment_method: { type: String, required: true },
    currency: { type: String, default: 'USD' }, // USD, CLP, OTHER
    currency_type: { type: String, default: null }, // Para OTHER: EUR, GBP, etc.
    usd_approximate: { type: String, default: null }, // Para OTHER: aproximado en USD
    comments: { type: String, default: null },
    staff_notes: { type: String, default: null },
    approved_by: { type: String, default: null },
    approved_by_username: { type: String, default: null },
    approved_at: { type: Date, default: null },
    closed_at: { type: Date, default: null },
    reopened_at: { type: Date, default: null },
    reopened_by: { type: String, default: null },
    
    // Conversación completa del ticket
    conversation: [{
        id: String,
        author_id: String,
        author_username: String,
        content: String,
        timestamp: Date,
        message_type: String,
        attachments: [{
            id: String,
            name: String,
            url: String,
            size: Number,
            content_type: String
        }],
        embeds: [mongoose.Schema.Types.Mixed],
        reactions: [String]
    }],
    conversation_saved_at: { type: Date, default: null },
    conversation_message_count: { type: Number, default: 0 },
    
    // Log de actividades del ticket
    activity_log: [{
        timestamp: Date,
        action: String,
        user_id: String,
        user_username: String,
        details: String
    }]
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'donationRequests'
});

// Métodos del esquema
donationRequestSchema.methods.approve = function(staffId, staffUsername) {
    this.status = 'approved';
    this.approved_by = staffId;
    this.approved_by_username = staffUsername;
    this.approved_at = new Date();
};

donationRequestSchema.methods.reject = function(staffId, staffUsername, notes = null) {
    this.status = 'rejected';
    this.approved_by = staffId;
    this.approved_by_username = staffUsername;
    this.approved_at = new Date();
    if (notes) this.staff_notes = notes;
};

donationRequestSchema.methods.close = function(userId = null, username = null) {
    this.status = 'closed';
    this.closed_at = new Date();
    this.logActivity('CLOSED', userId, username, 'Ticket cerrado');
};

donationRequestSchema.methods.reopen = function(staffId, staffUsername) {
    this.status = 'reopened';
    this.reopened_by = staffId;
    this.reopened_at = new Date();
};

donationRequestSchema.methods.addStaffNotes = function(notes) {
    this.staff_notes = notes;
};

// Método para guardar la conversación completa del ticket
donationRequestSchema.methods.saveConversation = async function(channel) {
    try {
        console.log(`💬 [DONATION] Iniciando captura de conversación para donación ${this.id} en canal ${channel.name}`);
        
        const messages = [];
        let lastMessageId = null;
        let totalMessages = 0;
        
        // Mapeo de tipos de mensaje de Discord.js
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
        
        // Obtener todos los mensajes del canal en lotes
        while (true) {
            const options = { limit: 100 };
            if (lastMessageId) {
                options.before = lastMessageId;
            }
            
            const batch = await channel.messages.fetch(options);
            if (batch.size === 0) break;
            
            for (const [messageId, message] of batch) {
                const messageData = {
                    id: message.id,
                    author_id: message.author.id,
                    author_username: message.author.username,
                    content: message.content || '',
                    timestamp: message.createdAt,
                    message_type: messageTypeMap[message.type] || 'UNKNOWN',
                    attachments: [],
                    embeds: [],
                    reactions: []
                };
                
                // Procesar attachments (imágenes, archivos, etc.)
                if (message.attachments.size > 0) {
                    for (const [attachmentId, attachment] of message.attachments) {
                        messageData.attachments.push({
                            id: attachment.id,
                            name: attachment.name,
                            url: attachment.url,
                            size: attachment.size,
                            content_type: attachment.contentType || null
                        });
                    }
                }
                
                // Procesar embeds
                if (message.embeds.length > 0) {
                    messageData.embeds = message.embeds.map(embed => ({
                        title: embed.title,
                        description: embed.description,
                        color: embed.color,
                        fields: embed.fields,
                        footer: embed.footer,
                        author: embed.author,
                        timestamp: embed.timestamp
                    }));
                }
                
                // Procesar reacciones
                if (message.reactions.cache.size > 0) {
                    messageData.reactions = message.reactions.cache.map(reaction => 
                        `${reaction.emoji.name}:${reaction.count}`
                    );
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
        
        // Guardar la conversación en el donation request
        this.conversation = messages;
        this.conversation_saved_at = new Date();
        this.conversation_message_count = totalMessages;
        
        console.log(`✅ [DONATION] Conversación capturada: ${totalMessages} mensajes, ${messages.filter(m => m.attachments.length > 0).length} con archivos`);
        
        // Registrar actividad
        this.logActivity('CONVERSATION_SAVED', null, null, `Conversación guardada: ${totalMessages} mensajes`);
        
        return {
            success: true,
            messageCount: totalMessages,
            attachmentCount: messages.filter(m => m.attachments.length > 0).length
        };
        
    } catch (error) {
        console.error(`❌ [DONATION] Error al capturar conversación para ${this.id}:`, error);
        this.logActivity('CONVERSATION_SAVE_ERROR', null, null, `Error al guardar conversación: ${error.message}`);
        
        return {
            success: false,
            error: error.message
        };
    }
};

// Método para registrar actividades del ticket
donationRequestSchema.methods.logActivity = function(action, userId = null, username = null, details = '') {
    if (!this.activity_log) {
        this.activity_log = [];
    }
    
    this.activity_log.push({
        timestamp: new Date(),
        action: action,
        user_id: userId,
        user_username: username,
        details: details
    });
    
    console.log(`📝 [DONATION-ACTIVITY] ${this.id}: ${action} - ${details}`);
};

// Middleware pre-save para validaciones adicionales
donationRequestSchema.pre('save', function (next) {
    // Validar que member_id sea válido
    if (this.member_id && !this.member_id.match(/^\d+$/)) {
        const error = new Error('El member_id debe ser un ID de Discord válido');
        return next(error);
    }
    next();
});

// Crear el modelo
const DonationRequest = mongoose.model('DonationRequest', donationRequestSchema);

// Métodos estáticos útiles
DonationRequest.findByMemberId = function (memberId) {
    return this.find({ member_id: memberId }).sort({ created_at: -1 });
};

DonationRequest.findByChannelId = function (channelId) {
    return this.findOne({ channel_id: channelId });
};

DonationRequest.findByStatus = function (status) {
    return this.find({ status }).sort({ created_at: -1 });
};

DonationRequest.findPending = function () {
    return this.find({ status: 'pending' }).sort({ created_at: -1 });
};

DonationRequest.findById = function (id) {
    return this.findOne({ id });
};

DonationRequest.generateId = function () {
    return `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

module.exports = DonationRequest; 