const { Events } = require('discord.js');
const { handleInteraction } = require('../extras/handlers');

/**
 * 🎯 EVENTO DE INTERACCIONES - COMPLETAMENTE MODULARIZADO
 * 
 * Este evento maneja TODAS las interacciones del bot:
 * - Comandos slash (/ping, /setup, etc.)
 * - Botones (verificar, crear ticket, cerrar ticket)
 * - Menús de selección (futuro)
 * - Modales (futuro)
 * 
 * ARQUITECTURA MODULAR:
 * ├── handlers/
 * │   ├── index.js              ← Router principal
 * │   ├── validations.js        ← Sistema de validaciones
 * │   ├── slashCommandHandler.js ← Manejo de comandos slash
 * │   └── buttonHandlers.js     ← Manejo de botones
 * 
 * VENTAJAS:
 * ✅ Código organizado y mantenible
 * ✅ Fácil agregar nuevos tipos de interacciones
 * ✅ Separación de responsabilidades
 * ✅ Logs detallados por módulo
 * ✅ Manejo de errores centralizado
 */
module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    // Enrutar la interacción al manejador apropiado
    await handleInteraction(interaction);
  }
};
