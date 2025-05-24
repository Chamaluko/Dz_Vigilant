const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { saveBackupToPostgres } = require('./db_bot_help/pg_backup');

const urlPing = process.env.URL_PING || `http://localhost:${process.env.PORT || 3000}`;

// Función para hacer ping al servidor
async function pingServer() {
  try {
    const response = await fetch(urlPing);
    console.log(`[CRON] Ping realizado: ${response.status === 200 ? '✅' : '❌'}`);
    
    // Hacer backup después de cada ping exitoso
    if (response.status === 200) {
      console.log('[CRON] Iniciando backup local y en PostgreSQL...');
      await saveBackupToPostgres();
    }
  } catch (error) {
    console.error('[CRON] Error al hacer ping:', error);
  }
}

function getRandomMinutes() {
  return 0.25
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
  console.log('[CRON] Cron iniciado - Ping aleatorio cada 1-2 minutos');
}

module.exports = startCron;
