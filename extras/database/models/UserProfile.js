const mongoose = require('mongoose');

// Esquema para Perfiles de Usuario
const userProfileSchema = new mongoose.Schema({
    member_id: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    display_name: { type: String, required: true },
    dz_coins: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },
    total_messages: { type: Number, default: 0, min: 0 },
    days_active: { type: Number, default: 0, min: 0 },
    last_active: { type: Date, default: Date.now },
    profile_theme: { type: String, default: 'default', enum: ['default', 'dark', 'light', 'purple', 'green', 'blue', 'gold'] },
    first_profile_creation: { type: Date, default: Date.now },
    last_profile_update: { type: Date, default: Date.now },
    joined_server_at: { type: Date },
    is_active: { type: Boolean, default: true },
    is_banned: { type: Boolean, default: false },
    is_premium: { type: Boolean, default: false },
    premium_until: { type: Date, default: null },
    admin_message_id: { type: String, default: null } // ID del mensaje en el canal de administración
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'userProfiles'
});

// Métodos del esquema
userProfileSchema.methods.addCoins = function(amount, reason = 'Unknown') {
    if (amount > 0) {
        this.dz_coins += amount;
        console.log(`💰 [COINS] ${this.username} recibió ${amount} DZ Coins. Razón: ${reason}`);
    }
};

userProfileSchema.methods.spendCoins = function(amount, reason = 'Unknown') {
    if (amount > 0 && this.dz_coins >= amount) {
        this.dz_coins -= amount;
        console.log(`💸 [COINS] ${this.username} gastó ${amount} DZ Coins. Razón: ${reason}`);
        return true;
    }
    return false;
};

userProfileSchema.methods.updateActivity = function() {
    const now = new Date();
    const lastActive = new Date(this.last_active);
    const daysDiff = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 1) {
        this.days_active += 1;
    }
    
    this.last_active = now;
    this.last_profile_update = now;
};

userProfileSchema.methods.resetConfiguration = function() {
    this.profile_theme = 'default';
    this.last_profile_update = new Date();
    
    console.log(`🔄 [CONFIG] Configuración restablecida para ${this.username}`);
};

// Middleware pre-save para validaciones
userProfileSchema.pre('save', function (next) {
    // Validar que member_id sea válido
    if (this.member_id && !this.member_id.match(/^\d+$/)) {
        const error = new Error('El member_id debe ser un ID de Discord válido');
        return next(error);
    }
    
    // Asegurar que los valores no sean negativos
    if (this.dz_coins < 0) this.dz_coins = 0;
    if (this.level < 1) this.level = 1;
    if (this.experience < 0) this.experience = 0;
    
    next();
});

// Crear el modelo
const UserProfile = mongoose.model('UserProfile', userProfileSchema);

// Métodos estáticos útiles
UserProfile.findByMemberId = function (memberId) {
    return this.findOne({ member_id: memberId });
};

UserProfile.findOrCreate = async function (memberId, username, displayName, joinedAt) {
    let profile = await this.findByMemberId(memberId);
    
    if (!profile) {
        profile = new this({
            member_id: memberId,
            username: username,
            display_name: displayName,
            joined_server_at: joinedAt,
            dz_coins: 0,
            first_profile_creation: new Date()
        });
        
        await profile.save();
        console.log(`🎉 [PROFILE] Nuevo perfil creado para ${username}`);
    }
    
    return profile;
};

UserProfile.getTopUsers = function (limit = 10) {
    return this.find({ is_active: true })
        .sort({ level: -1, dz_coins: -1 })
        .limit(limit)
        .select('username display_name level dz_coins');
};

UserProfile.getRichestUsers = function (limit = 10) {
    return this.find({ is_active: true })
        .sort({ dz_coins: -1 })
        .limit(limit)
        .select('username display_name dz_coins level');
};

UserProfile.getServerStats = async function () {
    const totalUsers = await this.countDocuments({ is_active: true });
    const totalCoinsInCirculation = await this.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: null, total: { $sum: '$dz_coins' } } }
    ]);
    
    const averageLevel = await this.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: null, avg: { $avg: '$level' } } }
    ]);
    
    return {
        totalUsers,
        totalCoinsInCirculation: totalCoinsInCirculation[0]?.total || 0,
        averageLevel: Math.round(averageLevel[0]?.avg || 1)
    };
};

module.exports = UserProfile; 