const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const urlPing = `http://localhost:${process.env.PORT || 3000}`;

// Función para hacer ping al servidor
async function pingServer() {
  try {
    const response = await fetch(urlPing);
    console.log(`[CRON] Ping realizado: ${response.status === 200 ? '✅' : '❌'}`);
  } catch (error) {
    console.error('[CRON] Error al hacer ping:', error);
  }
}

function getRandomMinutes() {
  return Math.floor(Math.random() * (13 - 4 + 1)) + 4; // Random entre 4 y 13
}

function startCron() {
  function scheduleNextPing() {
    const minutes = getRandomMinutes();
    console.log(`[CRON] Próximo ping en ${minutes} minutos`);
    
    setTimeout(() => {
      console.log('[CRON] Ejecutando ping programado...');
      pingServer();
      scheduleNextPing(); // Programar el siguiente ping
    }, minutes * 60 * 1000); // Convertir minutos a milisegundos
  }

  // Iniciar el primer ping
  scheduleNextPing();
  console.log('[CRON] Cron iniciado - Ping aleatorio cada 5-13 minutos');
}

module.exports = startCron;
