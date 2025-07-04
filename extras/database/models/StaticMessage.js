const mongoose = require('mongoose');

// Esquema para Mensajes Estáticos
const staticMessageSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    channel_id: { type: String, index: true, default: null },
    alias: { type: String, required: true, unique: true, trim: true, index: true },
    message_data: { type: String, default: null } // JSON string con datos del mensaje
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'staticMessages'
});

// Métodos del esquema StaticMessage
staticMessageSchema.methods.getMessageData = function () {
    try {
        return this.message_data ? JSON.parse(this.message_data) : null;
    } catch (error) {
        console.warn(`Error parsing message_data for ${this.alias}:`, error);
        return null;
    }
};

staticMessageSchema.methods.setMessageData = function (data) {
    this.message_data = JSON.stringify(data);
};

// Middleware pre-save para validaciones adicionales
staticMessageSchema.pre('save', function (next) {
    // Validar que el alias no tenga espacios
    if (this.alias && this.alias.includes(' ')) {
        const error = new Error('El alias no puede contener espacios');
        return next(error);
    }
    next();
});

// Crear el modelo
const StaticMessage = mongoose.model('StaticMessage', staticMessageSchema);

// Métodos estáticos útiles
StaticMessage.findByAlias = function (alias) {
    return this.findOne({ alias });
};

StaticMessage.findByDiscordId = function (id) {
    return this.findOne({ id });
};

module.exports = StaticMessage; 