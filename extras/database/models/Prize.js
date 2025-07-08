const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  user_username: { type: String, default: null },
  type_event: { type: String, required: true }, // 'sorteo', 'evento', etc.
  id_event: { type: String, required: true },
  prize: { type: String, required: true },
  status: { type: String, required: true, enum: ['pendiente', 'entregado'], default: 'pendiente', index: true },
  delivered_at: { type: Date, default: null },
  delivered_by: { type: String, default: null }
}, {
  timestamps: { createdAt: 'date_won', updatedAt: 'updated_at' },
  collection: 'prizes'
});

module.exports = mongoose.model('Prize', prizeSchema); 