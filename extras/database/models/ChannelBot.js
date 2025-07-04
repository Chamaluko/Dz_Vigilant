const mongoose = require('mongoose');

// Esquema para Canales del Bot
const channelBotSchema = new mongoose.Schema({
    alias: { type: String, required: true, unique: true, trim: true, index: true },
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['text', 'voice', 'category', 'news', 'thread'], default: 'text' },
    category: { type: String, default: null, trim: true }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'channelsBot'
});

// Métodos del esquema ChannelBot
channelBotSchema.methods.isSkipped = function () {
    return this.id === 'SKIPPED';
};

channelBotSchema.methods.isInCategory = function (categoryName) {
    return this.category === categoryName;
};

// Middleware pre-save para validaciones adicionales
channelBotSchema.pre('save', function (next) {
    // Validar que el alias no tenga espacios
    if (this.alias && this.alias.includes(' ')) {
        const error = new Error('El alias no puede contener espacios');
        return next(error);
    }
    next();
});

// Crear el modelo
const ChannelBot = mongoose.model('ChannelBot', channelBotSchema);

// Métodos estáticos útiles
ChannelBot.findByAlias = function (alias) {
    return this.findOne({ alias });
};

ChannelBot.findByDiscordId = function (id) {
    return this.findOne({ id });
};

module.exports = ChannelBot; 