const db = require('./extras/database/indexDB');

async function cleanDatabase() {
    try {
        console.log('🧹 Iniciando limpieza de la base de datos...');

        // Limpiar tabla de roles
        await db.run('DELETE FROM rolesBot');
        console.log('✅ Tabla rolesBot limpiada');

        // Limpiar tabla de canales
        await db.run('DELETE FROM channelsBot');
        console.log('✅ Tabla channelsBot limpiada');

        console.log('✨ Base de datos limpiada exitosamente');
    } catch (error) {
        console.error('❌ Error al limpiar la base de datos:', error);
    } finally {
        // Cerrar la conexión
        await db.close();
    }
}

// Ejecutar la limpieza
cleanDatabase(); 