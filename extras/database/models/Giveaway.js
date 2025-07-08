const mongoose = require('mongoose');

// Esquema para Sorteos (Giveaways)
const giveawaySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  guild_id: { type: String, required: true, index: true },
  channel_id: { type: String, required: true },
  message_id: { type: String, default: null },
  created_by_id: { type: String, required: true },
  created_by_username: { type: String, default: null },

  // Criterio para seleccionar participantes
  criteria_type: { type: String, required: true, enum: ['all', 'role', 'users'] }, // all = todos los miembros, role = por rol, users = lista específica
  role_id: { type: String, default: null },
  role_name: { type: String, default: null },
  user_ids: { type: [String], default: [] }, // IDs proporcionados manualmente

  // Participantes reales en el momento de crear el sorteo (para reproducibilidad)
  participant_ids: { type: [String], default: [] },

  // Detalles del sorteo
  prize: { type: String, required: true },
  end_at: { type: Date, required: true, index: true },

  // Resultado
  winner_id: { type: String, default: null },
  winner_username: { type: String, default: null },
  status: { type: String, required: true, enum: ['pending', 'completed', 'cancelled'], default: 'pending', index: true },
  announce_general: { type: Boolean, default: true },

  description: { type: String, default: null },

  excluded_ids: { type: [String], default: [] },

  // NUEVO: nombre o título del sorteo
  title: { type: String, default: '', index: false },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'giveaways'
});

// MÉTODOS DE INSTANCIA ------------------------------------------------------

giveawaySchema.methods.setWinner = function(userId, username) {
  this.winner_id = userId;
  this.winner_username = username;
  this.status = 'completed';
};

// MÉTODOS ESTÁTICOS ---------------------------------------------------------

// Encuentra sorteos aún pendientes cuyo fin es futuro o presente
// (útil para reprogramar al iniciar el bot)
giveawaySchema.statics.findPending = function() {
  return this.find({ status: 'pending', end_at: { $gte: new Date() } });
};

const Giveaway = mongoose.model('Giveaway', giveawaySchema);

module.exports = Giveaway; 