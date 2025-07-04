const mongoose = require('mongoose');

// Esquema para Donaciones Completadas
const completedDonationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    member_id: { type: String, required: true, index: true },
    member_username: { type: String, required: true },
    amount_usd: { type: String, required: true },
    payment_method: { type: String, required: true },
    dz_coins_given: { type: Number, required: true },
    approved_by_id: { type: String, required: true },
    approved_by_username: { type: String, required: true },
    approval_reason: { type: String, default: 'Donación verificada y aprobada' },
    original_request_id: { type: String, required: true }, // Referencia al DonationRequest original
    status: { type: String, enum: ['completed', 'processed'], default: 'completed' }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'completedDonations'
});

// Middleware pre-save para validaciones adicionales
completedDonationSchema.pre('save', function (next) {
    // Validar que member_id sea válido
    if (this.member_id && !this.member_id.match(/^\d+$/)) {
        const error = new Error('El member_id debe ser un ID de Discord válido');
        return next(error);
    }
    
    // Validar que dz_coins_given sea positivo
    if (this.dz_coins_given && this.dz_coins_given <= 0) {
        const error = new Error('Los DZ Coins otorgados deben ser mayor que 0');
        return next(error);
    }
    
    next();
});

// Crear el modelo
const CompletedDonation = mongoose.model('CompletedDonation', completedDonationSchema);

// Métodos estáticos útiles
CompletedDonation.findByMemberId = function (memberId) {
    return this.find({ member_id: memberId }).sort({ created_at: -1 });
};

CompletedDonation.findById = function (id) {
    return this.findOne({ id });
};

CompletedDonation.findByStatus = function (status) {
    return this.find({ status }).sort({ created_at: -1 });
};

CompletedDonation.getStats = function () {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalDonations: { $sum: 1 },
                totalCoinsGiven: { $sum: '$dz_coins_given' },
                avgDonationAmount: { $avg: { $toDouble: '$amount_usd' } }
            }
        }
    ]);
};

CompletedDonation.generateId = function () {
    return `completed_donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

module.exports = CompletedDonation; 