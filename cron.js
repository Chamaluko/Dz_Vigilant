const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const urlPing = process.env.URL_PING || `http://localhost:${process.env.PORT || 3000}`;
const min = 3;
const max = 10;

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
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  console.log(`[CRON] Cron iniciado - Ping aleatorio cada ${min}-${max} minutos`);
}

module.exports = startCron;
