const mongoose = require('mongoose');

// Esquema para Roles del Bot
const roleBotSchema = new mongoose.Schema({
    alias: { type: String, required: true, unique: true, trim: true, index: true},
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['custom', 'system', 'admin'], default: 'custom' },
    permissions: { type: String, default: '[]' } // JSON string de permisos
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'rolesBot'
});

// Métodos del esquema RoleBot
roleBotSchema.methods.getPermissions = function () {
    try {
        return JSON.parse(this.permissions || '[]');
    } catch (error) {
        console.warn(`Error parsing permissions for role ${this.alias}:`, error);
        return [];
    }
};

roleBotSchema.methods.setPermissions = function (permissions) {
    this.permissions = JSON.stringify(permissions || []);
};

roleBotSchema.methods.isSkipped = function () {
    return this.id === 'SKIPPED';
};

// Middleware pre-save para validaciones adicionales
roleBotSchema.pre('save', function (next) {
    // Validar que el alias no tenga espacios
    if (this.alias && this.alias.includes(' ')) {
        const error = new Error('El alias no puede contener espacios');
        return next(error);
    }
    next();
});

// Crear el modelo
const RoleBot = mongoose.model('RoleBot', roleBotSchema);

// Métodos estáticos útiles
RoleBot.findByAlias = function (alias) {
    return this.findOne({ alias });
};

RoleBot.findByDiscordId = function (id) {
    return this.findOne({ id });
};

module.exports = RoleBot; 